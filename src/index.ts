import type { AnyAction, Middleware, Reducer, ThunkDispatch } from '@reduxjs/toolkit';
import { buildThunks, QueryApi } from './buildThunks';
import { buildSlice, SliceActions } from './buildSlice';
import { buildActionMaps, EndpointActions } from './buildActionMaps';
import { buildSelectors, Selectors } from './buildSelectors';
import { buildHooks, Hooks } from './buildHooks';
import { buildMiddleware } from './buildMiddleware';
import {
  EndpointDefinitions,
  EndpointBuilder,
  DefinitionType,
  isQueryDefinition,
  isMutationDefinition,
} from './endpointDefinitions';
import type { CombinedState, QueryCacheKey, QueryStatePhantomType, RootState } from './apiState';
import { assertCast, UnionToIntersection } from './tsHelpers';

export { fetchBaseQuery } from './fetchBaseQuery';
export { QueryStatus } from './apiState';

export type SerializeQueryArgs<InternalQueryArgs> = (args: InternalQueryArgs, endpoint: string) => string;
export type InternalSerializeQueryArgs<InternalQueryArgs> = (
  args: InternalQueryArgs,
  endpoint: string
) => QueryCacheKey;

function defaultSerializeQueryArgs(args: any, endpoint: string) {
  return `${endpoint}/${JSON.stringify(args)}`;
}

export function createApi<
  InternalQueryArgs,
  Definitions extends EndpointDefinitions,
  ReducerPath extends string,
  EntityTypes extends string
>({
  baseQuery,
  reducerPath,
  serializeQueryArgs = defaultSerializeQueryArgs,
  endpoints,
  keepUnusedDataFor = 60,
}: {
  baseQuery(args: InternalQueryArgs, api: QueryApi): any;
  entityTypes: readonly EntityTypes[];
  reducerPath: ReducerPath;
  serializeQueryArgs?: SerializeQueryArgs<InternalQueryArgs>;
  endpoints(build: EndpointBuilder<InternalQueryArgs, EntityTypes>): Definitions;
  keepUnusedDataFor?: number;
}): Api<InternalQueryArgs, Definitions, ReducerPath, EntityTypes> {
  type State = CombinedState<Definitions, EntityTypes>;

  assertCast<InternalSerializeQueryArgs<InternalQueryArgs>>(serializeQueryArgs);

  const endpointDefinitions: EndpointDefinitions = {};

  const { queryThunk, mutationThunk } = buildThunks({ baseQuery, reducerPath, endpointDefinitions });

  const { reducer, actions: sliceActions } = buildSlice({
    endpointDefinitions,
    queryThunk,
    mutationThunk,
    reducerPath,
  });
  assertCast<Reducer<State & QueryStatePhantomType<ReducerPath>, AnyAction>>(reducer);

  const { middleware } = buildMiddleware({
    reducerPath,
    endpointDefinitions,
    queryThunk,
    mutationThunk,
    keepUnusedDataFor,
    sliceActions,
  });

  const api: Api<InternalQueryArgs, {}, ReducerPath, EntityTypes> = {
    reducerPath,
    selectors: {},
    actions: {},
    internalActions: sliceActions,
    hooks: {},
    reducer,
    middleware,
    injectEndpoints,
  };

  const { buildQuerySelector, buildMutationSelector } = buildSelectors({
    serializeQueryArgs,
    reducerPath,
  });

  const { buildQueryAction, buildMutationAction } = buildActionMaps({
    queryThunk,
    mutationThunk,
    serializeQueryArgs,
    querySelectors: api.selectors as any,
    mutationSelectors: api.selectors as any,
    sliceActions,
  });

  const { buildQueryHook, buildMutationHook } = buildHooks({
    querySelectors: api.selectors as any,
    queryActions: api.actions as any,
    mutationSelectors: api.selectors as any,
    mutationActions: api.actions as any,
  });

  function injectEndpoints(inject: Parameters<typeof api.injectEndpoints>[0]) {
    const evaluatedEndpoints = inject.endpoints({
      query: (x) => ({ ...x, type: DefinitionType.query }),
      mutation: (x) => ({ ...x, type: DefinitionType.mutation }),
    });
    for (const [endpoint, definition] of Object.entries(evaluatedEndpoints)) {
      if (!inject.overrideExisting && endpoint in endpointDefinitions) {
        throw new Error(
          `called \`injectEndpoints\` to override already-existing endpoint ${endpoint} without specifying \`overrideExisting: true\``
        );
      }
      endpointDefinitions[endpoint] = definition;

      assertCast<Api<InternalQueryArgs, Record<string, any>, ReducerPath, EntityTypes>>(api);
      if (isQueryDefinition(definition)) {
        api.selectors[endpoint] = buildQuerySelector(endpoint, definition);
        api.actions[endpoint] = buildQueryAction(endpoint, definition);
        api.hooks[endpoint] = { useQuery: buildQueryHook(endpoint) };
      } else if (isMutationDefinition(definition)) {
        api.selectors[endpoint] = buildMutationSelector(endpoint, definition);
        api.actions[endpoint] = buildMutationAction(endpoint, definition);
        api.hooks[endpoint] = { useMutation: buildMutationHook(endpoint) };
      }
    }

    return api as any;
  }

  return api.injectEndpoints({ endpoints });
}

export interface Api<
  InternalQueryArgs,
  Definitions extends EndpointDefinitions,
  ReducerPath extends string,
  EntityTypes extends string
> {
  reducerPath: ReducerPath;
  actions: EndpointActions<Definitions>;
  internalActions: SliceActions;
  reducer: Reducer<CombinedState<Definitions, EntityTypes> & QueryStatePhantomType<ReducerPath>, AnyAction>;
  selectors: Selectors<Definitions, RootState<Definitions, EntityTypes, ReducerPath>>;
  middleware: Middleware<{}, RootState<Definitions, string, ReducerPath>, ThunkDispatch<any, any, AnyAction>>;
  hooks: Hooks<Definitions>;
  injectEndpoints<NewDefinitions extends EndpointDefinitions>(_: {
    endpoints: (build: EndpointBuilder<InternalQueryArgs, EntityTypes>) => NewDefinitions;
    overrideExisting?: boolean;
  }): Api<InternalQueryArgs, Definitions & NewDefinitions, ReducerPath, EntityTypes>;
}

export type ApiWithInjectedEndpoints<
  ApiDefinition extends Api<any, any, any, any>,
  Injections extends ApiDefinition extends Api<infer I, any, infer R, infer E>
    ? [Api<I, any, R, E>, ...Api<I, any, R, E>[]]
    : never
> = ApiDefinition & {
  actions: Partial<UnionToIntersection<Injections[number]['actions']>>;
  selectors: Partial<UnionToIntersection<Injections[number]['selectors']>>;
  hooks: Partial<UnionToIntersection<Injections[number]['hooks']>>;
};
