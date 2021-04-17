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
  /**
   * The base query used by each endpoint if no `queryFn` option is specified. RTK Query exports a utility called [fetchBaseQuery](./fetchBaseQuery) as a lightweight wrapper around `fetch` for common use-cases.
   */
  baseQuery: BaseQuery;
  /**
   * An array of string entity type names. Specifying entity types is optional, but you should define them so that they can be used for caching and invalidation. When defining an entity type, you will be able to [provide](../concepts/mutations#provides) them with `provides` and [invalidate](../concepts/mutations#advanced-mutations-with-revalidation) them with `invalidates` when configuring [endpoints](#endpoints).
   */
  entityTypes?: readonly EntityTypes[];
  /**
   * The `reducerPath` is a _unique_ key that your service will be mounted to in your store. If you call `createApi` more than once in your application, you will need to provide a unique value each time. Defaults to `api`.
   */
  reducerPath?: ReducerPath;
  /**
   * Accepts a custom function if you have a need to change the creation of cache keys for any reason.
   */
  serializeQueryArgs?: SerializeQueryArgs<BaseQueryArg<BaseQuery>>;
  /**
   * Endpoints are just a set of operations that you want to perform against your server. You define them as an object using the builder syntax. There are two basic endpoint types: [`query`](../concepts/queries) and [`mutation`](../concepts/mutations).
   */
  endpoints(build: EndpointBuilder<BaseQuery, EntityTypes, ReducerPath>): Definitions;
  /**
   * Defaults to 60 (this value is in seconds). This is how long RTK Query will keep your data cached for after the last component unsubscribes. For example, if you query an endpoint, then unmount the component, then mount another component that makes the same request within the given time frame, the most recent value will be served from the cache.
   */
  keepUnusedDataFor?: number;
  /**
   * Defaults to `false`. This setting allows you to control whether RTK Query will only serve a cached result, or if it should `refetch` when set to `true` or if an adequate amount of time has passed since the last successful query result.
   * - `false` - Will not cause a query to be performed _unless_ it does not exist yet.
   * - `true` - Will always refetch when a new subscriber to a query is added. Behaves the same as calling the `refetch` callback or passing `forceRefetch: true` in the action creator.
   * - `number` - **Value is in seconds**. If a number is provided and there is an existing query in the cache, it will compare the current time vs the last fulfilled timestamp, and only refetch if enough time has elapsed.
   *
   * If you specify this option alongside `skip: true`, this **will not be evaluated** until `skip` is false.
   */
  refetchOnMountOrArgChange?: boolean | number;
  /**
   * Defaults to `false`. This setting allows you to control whether RTK Query will try to refetch all subscribed queries after the application window regains focus.
   *
   * If you specify this option alongside `skip: true`, this **will not be evaluated** until `skip` is false.
   */
  refetchOnFocus?: boolean;
  /**
   * Defaults to `false`. This setting allows you to control whether RTK Query will try to refetch all subscribed queries after regaining a network connection.
   *
   * If you specify this option alongside `skip: true`, this **will not be evaluated** until `skip` is false.
   */
  refetchOnReconnect?: boolean;
}

export type CreateApi<Modules extends ModuleName> = {
  /**
   * Creates a service to use in your application. Contains only the basic redux logic (the core module).
   *
   * @link https://rtk-query-docs.netlify.app/api/createApi
   */
  <
    BaseQuery extends BaseQueryFn,
    Definitions extends EndpointDefinitions,
    ReducerPath extends string = 'api',
    EntityTypes extends string = never
  >(
    options: CreateApiOptions<BaseQuery, Definitions, ReducerPath, EntityTypes>
  ): Api<BaseQuery, Definitions, ReducerPath, EntityTypes, Modules>;
};

/**
 * Builds a `createApi` method based on the provided `modules`.
 *
 * @link https://rtk-query-docs.netlify.app/concepts/customizing-create-api
 *
 * @example
 * ```ts
 * const MyContext = React.createContext<ReactReduxContextValue>(null as any);
 * const customCreateApi = buildCreateApi(
 *   coreModule(),
 *   reactHooksModule({ useDispatch: createDispatchHook(MyContext) })
 * );
 * ```
 *
 * @param modules - A variable number of modules that customize how the `createApi` method handles endpoints
 * @returns A `createApi` method using the provided `modules`.
 */
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
