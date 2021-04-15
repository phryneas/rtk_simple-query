/**
 * Note: this file should import all other files for type discovery and declaration merging
 */
import { buildThunks, PatchQueryResultThunk, UpdateQueryResultThunk } from './buildThunks';
import { ActionCreatorWithPayload, AnyAction, Middleware, Reducer, ThunkAction, ThunkDispatch } from '@reduxjs/toolkit';
import {
  EndpointDefinitions,
  QueryArgFrom,
  QueryDefinition,
  MutationDefinition,
  AssertEntityTypes,
  isQueryDefinition,
  isMutationDefinition,
  FullEntityDescription,
} from '../endpointDefinitions';
import { CombinedState, QueryKeys, RootState } from './apiState';
import './buildSelectors';
import { Api, Module } from '../apiTypes';
import { onFocus, onFocusLost, onOnline, onOffline } from './setupListeners';
import { buildSlice } from './buildSlice';
import { buildMiddleware } from './buildMiddleware';
import { buildSelectors } from './buildSelectors';
import { buildInitiate } from './buildInitiate';
import { assertCast, Id, safeAssign } from '../tsHelpers';
import { InternalSerializeQueryArgs } from '../defaultSerializeQueryArgs';
import { SliceActions } from './buildSlice';
import { BaseQueryFn } from '../baseQueryTypes';

export type PrefetchOptions =
  | { force?: boolean }
  | {
      ifOlderThan?: false | number;
    };

export const coreModuleName = Symbol();
export type CoreModule = typeof coreModuleName;

declare module '../apiTypes' {
  export interface ApiModules<
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    BaseQuery extends BaseQueryFn,
    Definitions extends EndpointDefinitions,
    ReducerPath extends string,
    EntityTypes extends string
  > {
    [coreModuleName]: {
      reducerPath: ReducerPath;
      internalActions: InternalActions;
      reducer: Reducer<CombinedState<Definitions, EntityTypes, ReducerPath>, AnyAction>;
      middleware: Middleware<{}, RootState<Definitions, string, ReducerPath>, ThunkDispatch<any, any, AnyAction>>;
      util: {
        prefetchThunk<EndpointName extends QueryKeys<EndpointDefinitions>>(
          endpointName: EndpointName,
          arg: QueryArgFrom<Definitions[EndpointName]>,
          options: PrefetchOptions
        ): ThunkAction<void, any, any, AnyAction>;
        updateQueryResult: UpdateQueryResultThunk<Definitions, RootState<Definitions, string, ReducerPath>>;
        patchQueryResult: PatchQueryResultThunk<Definitions, RootState<Definitions, string, ReducerPath>>;
        resetApiState: SliceActions['resetApiState'];
        invalidateEntities: ActionCreatorWithPayload<Array<EntityTypes | FullEntityDescription<EntityTypes>>, string>;
      };
      // If you actually care about the return value, use useQuery
      usePrefetch<EndpointName extends QueryKeys<Definitions>>(
        endpointName: EndpointName,
        options?: PrefetchOptions
      ): (arg: QueryArgFrom<Definitions[EndpointName]>, options?: PrefetchOptions) => void;
      endpoints: {
        [K in keyof Definitions]: Definitions[K] extends QueryDefinition<any, any, any, any, any>
          ? Id<ApiEndpointQuery<Definitions[K], Definitions>>
          : Definitions[K] extends MutationDefinition<any, any, any, any, any>
          ? Id<ApiEndpointMutation<Definitions[K], Definitions>>
          : never;
      };
    };
  }
}

export interface ApiEndpointQuery<
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Definition extends QueryDefinition<any, any, any, any, any>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Definitions extends EndpointDefinitions
> {}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface ApiEndpointMutation<
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Definition extends MutationDefinition<any, any, any, any, any>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Definitions extends EndpointDefinitions
> {}

export type ListenerActions = {
  /**
   * Will cause the RTK Query middleware to trigger any refetchOnReconnect-related behavior
   * @link https://rtk-query-docs.netlify.app/api/setupListeners
   */
  onOnline: typeof onOnline;
  onOffline: typeof onOffline;
  /**
   * Will cause the RTK Query middleware to trigger any refetchOnFocus-related behavior
   * @link https://rtk-query-docs.netlify.app/api/setupListeners
   */
  onFocus: typeof onFocus;
  onFocusLost: typeof onFocusLost;
};

export type InternalActions = SliceActions & ListenerActions;

export const coreModule = (): Module<CoreModule> => ({
  name: coreModuleName,
  init(
    api,
    {
      baseQuery,
      entityTypes,
      reducerPath,
      serializeQueryArgs,
      keepUnusedDataFor,
      refetchOnMountOrArgChange,
      refetchOnFocus,
      refetchOnReconnect,
    },
    context
  ) {
    assertCast<InternalSerializeQueryArgs<any>>(serializeQueryArgs);

    const assertEntityType: AssertEntityTypes = (entity) => {
      if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
        if (!entityTypes.includes(entity.type as any)) {
          console.error(`Entity type '${entity.type}' was used, but not specified in \`entityTypes\`!`);
        }
      }
      return entity;
    };

    Object.assign(api, {
      reducerPath,
      endpoints: {},
      internalActions: {
        onOnline,
        onOffline,
        onFocus,
        onFocusLost,
      },
      util: {},
    });

    const {
      queryThunk,
      mutationThunk,
      patchQueryResult,
      updateQueryResult,
      prefetchThunk,
      buildMatchThunkActions,
    } = buildThunks({
      baseQuery,
      reducerPath,
      context,
      api,
      serializeQueryArgs,
    });

    const { reducer, actions: sliceActions } = buildSlice({
      context,
      queryThunk,
      mutationThunk,
      reducerPath,
      assertEntityType,
      config: { refetchOnFocus, refetchOnReconnect, refetchOnMountOrArgChange, keepUnusedDataFor, reducerPath },
    });

    safeAssign(api.util, {
      patchQueryResult,
      updateQueryResult,
      prefetchThunk,
      resetApiState: sliceActions.resetApiState,
    });
    safeAssign(api.internalActions, sliceActions);

    const { middleware, actions: middlewareActions } = buildMiddleware({
      reducerPath,
      context,
      queryThunk,
      mutationThunk,
      api,
      assertEntityType,
    });
    safeAssign(api.util, middlewareActions);

    safeAssign(api, { reducer: reducer as any, middleware });

    const { buildQuerySelector, buildMutationSelector } = buildSelectors({
      serializeQueryArgs: serializeQueryArgs as any,
      reducerPath,
    });

    const { buildInitiateQuery, buildInitiateMutation } = buildInitiate({
      queryThunk,
      mutationThunk,
      api,
      serializeQueryArgs: serializeQueryArgs as any,
    });

    return {
      name: coreModuleName,
      injectEndpoint(endpointName, definition) {
        const anyApi = (api as any) as Api<any, Record<string, any>, string, string, CoreModule>;
        anyApi.endpoints[endpointName] ??= {} as any;
        if (isQueryDefinition(definition)) {
          safeAssign(
            anyApi.endpoints[endpointName],
            {
              select: buildQuerySelector(endpointName, definition),
              initiate: buildInitiateQuery(endpointName, definition),
            },
            buildMatchThunkActions(queryThunk, endpointName)
          );
        } else if (isMutationDefinition(definition)) {
          safeAssign(
            anyApi.endpoints[endpointName],
            {
              select: buildMutationSelector(),
              initiate: buildInitiateMutation(endpointName, definition),
            },
            buildMatchThunkActions(mutationThunk, endpointName)
          );
        }
      },
    };
  },
});
