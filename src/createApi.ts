import type { Api, ApiContext, Module, ModuleName } from './apiTypes';
import type { BaseQueryArg, BaseQueryFn } from './baseQueryTypes';
import { defaultSerializeQueryArgs, SerializeQueryArgs } from './defaultSerializeQueryArgs';
import { DefinitionType, EndpointBuilder, EndpointDefinitions } from './endpointDefinitions';

export interface CreateApiOptions<
  BaseQuery extends BaseQueryFn,
  Definitions extends EndpointDefinitions,
  ReducerPath extends string = 'api',
  EntityTypes extends string = never
> {
  baseQuery: BaseQuery;
  entityTypes?: readonly EntityTypes[];
  reducerPath?: ReducerPath;
  serializeQueryArgs?: SerializeQueryArgs<BaseQueryArg<BaseQuery>>;
  endpoints(build: EndpointBuilder<BaseQuery, EntityTypes, ReducerPath>): Definitions;
  keepUnusedDataFor?: number;
  refetchOnMountOrArgChange?: boolean | number;
  refetchOnFocus?: boolean;
  refetchOnReconnect?: boolean;
}

export type CreateApi<Modules extends ModuleName> = <
  BaseQuery extends BaseQueryFn,
  Definitions extends EndpointDefinitions,
  ReducerPath extends string = 'api',
  EntityTypes extends string = never
>(
  options: CreateApiOptions<BaseQuery, Definitions, ReducerPath, EntityTypes>
) => Api<BaseQuery, Definitions, ReducerPath, EntityTypes, Modules>;

export function buildCreateApi<Modules extends [Module<any>, ...Module<any>[]]>(
  ...modules: Modules
): CreateApi<Modules[number]['name']> {
  return function baseCreateApi(options) {
    const optionsWithDefaults = {
      reducerPath: 'api',
      serializeQueryArgs: defaultSerializeQueryArgs,
      keepUnusedDataFor: 60,
      refetchOnMountOrArgChange: false,
      refetchOnFocus: false,
      refetchOnReconnect: false,
      ...options,
      entityTypes: [...(options.entityTypes || [])],
    };

    const context: ApiContext<EndpointDefinitions> = {
      endpointDefinitions: {},
      batch(fn) {
        // placeholder "batch" method to be overridden by plugins, for example with React.unstable_batchedUpdate
        fn();
      },
    };

    const api = {
      injectEndpoints,
      enhanceEndpoints({ addEntityTypes, endpoints }) {
        if (addEntityTypes) {
          for (const eT of addEntityTypes) {
            if (!optionsWithDefaults.entityTypes.includes(eT as any)) {
              optionsWithDefaults.entityTypes.push(eT as any);
            }
          }
        }
        if (endpoints) {
          for (const [endpointName, partialDefinition] of Object.entries(endpoints)) {
            if (typeof partialDefinition === 'function') {
              partialDefinition(context.endpointDefinitions[endpointName]);
            }
            Object.assign(context.endpointDefinitions[endpointName] || {}, partialDefinition);
          }
        }
        return api;
      },
    } as Api<BaseQueryFn, {}, string, string, Modules[number]['name']>;

    const initializedModules = modules.map((m) => m.init(api as any, optionsWithDefaults, context));

    function injectEndpoints(inject: Parameters<typeof api.injectEndpoints>[0]) {
      const evaluatedEndpoints = inject.endpoints({
        query: (x) => ({ ...x, type: DefinitionType.query } as any),
        mutation: (x) => ({ ...x, type: DefinitionType.mutation } as any),
      });

      for (const [endpointName, definition] of Object.entries(evaluatedEndpoints)) {
        if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
          if (!inject.overrideExisting && endpointName in context.endpointDefinitions) {
            console.error(
              `called \`injectEndpoints\` to override already-existing endpointName ${endpointName} without specifying \`overrideExisting: true\``
            );
            continue;
          }
        }
        context.endpointDefinitions[endpointName] = definition;
        for (const m of initializedModules) {
          m.injectEndpoint(endpointName, definition);
        }
      }

      return api as any;
    }

    return api.injectEndpoints({ endpoints: options.endpoints as any });
  };
}
