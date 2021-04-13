import { buildHooks, MutationHooks, QueryHooks } from './buildHooks';
import {
  EndpointDefinitions,
  QueryDefinition,
  MutationDefinition,
  isQueryDefinition,
  isMutationDefinition,
} from '../endpointDefinitions';
import { TS41Hooks } from '../ts41Types';
import { Api, Module } from '../apiTypes';
import { capitalize } from '../utils';
import { safeAssign } from '../tsHelpers';
import { BaseQueryFn } from '../baseQueryTypes';

import {
  useDispatch as rrUseDispatch,
  useSelector as rrUseSelector,
  useStore as rrUseStore,
  batch as rrBatch,
} from 'react-redux';

export const reactHooksModuleName = Symbol();
export type ReactHooksModule = typeof reactHooksModuleName;

declare module '../apiTypes' {
  export interface ApiModules<
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    BaseQuery extends BaseQueryFn,
    Definitions extends EndpointDefinitions,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ReducerPath extends string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    EntityTypes extends string
  > {
    [reactHooksModuleName]: {
      endpoints: {
        [K in keyof Definitions]: Definitions[K] extends QueryDefinition<any, any, any, any, any>
          ? QueryHooks<Definitions[K]>
          : Definitions[K] extends MutationDefinition<any, any, any, any, any>
          ? MutationHooks<Definitions[K]>
          : never;
      };
    } & TS41Hooks<Definitions>;
  }
}

type RR = typeof import('react-redux');

export interface ReactHooksModuleOptions {
  batch?: RR['batch'];
  useDispatch?: RR['useDispatch'];
  useSelector?: RR['useSelector'];
  useStore?: RR['useStore'];
}

export const reactHooksModule = ({
  batch = rrBatch,
  useDispatch = rrUseDispatch,
  useSelector = rrUseSelector,
  useStore = rrUseStore,
}: ReactHooksModuleOptions = {}): Module<ReactHooksModule> => ({
  name: reactHooksModuleName,
  init(api, options, context) {
    const { buildQueryHooks, buildMutationHook, usePrefetch } = buildHooks({
      api,
      moduleOptions: { batch, useDispatch, useSelector, useStore },
    });
    safeAssign(api, { usePrefetch });
    safeAssign(context, { batch });

    return {
      injectEndpoint(endpointName, definition) {
        const anyApi = (api as any) as Api<any, Record<string, any>, string, string, ReactHooksModule>;
        if (isQueryDefinition(definition)) {
          const { useQuery, useLazyQuery, useQueryState, useQuerySubscription } = buildQueryHooks(endpointName);
          safeAssign(anyApi.endpoints[endpointName], {
            useQuery,
            useLazyQuery,
            useQueryState,
            useQuerySubscription,
          });
          (api as any)[`use${capitalize(endpointName)}Query`] = useQuery;
          (api as any)[`useLazy${capitalize(endpointName)}Query`] = useLazyQuery;
        } else if (isMutationDefinition(definition)) {
          const useMutation = buildMutationHook(endpointName);
          safeAssign(anyApi.endpoints[endpointName], {
            useMutation,
          });
          (api as any)[`use${capitalize(endpointName)}Mutation`] = useMutation;
        }
      },
    };
  },
});
