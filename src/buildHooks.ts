import { AnyAction, AsyncThunkAction, ThunkDispatch } from '@reduxjs/toolkit';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector, batch } from 'react-redux';
import { MutationSubState, QuerySubState } from './apiState';
import {
  EndpointDefinitions,
  MutationDefinition,
  QueryDefinition,
  isQueryDefinition,
  isMutationDefinition,
} from './endpointDefinitions';
import { QueryResultSelectors, MutationResultSelectors } from './buildSelectors';
import { QueryActions, MutationActions } from './buildActionMaps';
import { UnsubscribeMutationResult, UnsubscribeQueryResult } from './buildSlice';

export type QueryHook<D extends QueryDefinition<any, any, any, any>> = D extends QueryDefinition<
  infer QueryArg,
  any,
  any,
  any
>
  ? (arg: QueryArg) => QuerySubState<D>
  : never;

export type MutationHook<D extends MutationDefinition<any, any, any, any>> = D extends MutationDefinition<
  infer QueryArg,
  any,
  any,
  infer ResultType
>
  ? () => [(arg: QueryArg) => Promise<ResultType>, MutationSubState<D>]
  : never;

export type Hooks<Definitions extends EndpointDefinitions> = {
  [K in keyof Definitions]: Definitions[K] extends QueryDefinition<infer QueryArg, any, any, infer ResultType>
    ? {
        useQuery: QueryHook<Definitions[K]>;
      }
    : Definitions[K] extends MutationDefinition<infer QueryArg, any, any, infer ResultType>
    ? {
        useMutation: MutationHook<Definitions[K]>;
      }
    : never;
};

export function buildHooks<Definitions extends EndpointDefinitions>({
  endpointDefinitions,
  querySelectors,
  queryActions,
  unsubscribeQueryResult,
  mutationSelectors,
  mutationActions,
  unsubscribeMutationResult,
}: {
  endpointDefinitions: Definitions;
  querySelectors: QueryResultSelectors<Definitions, any>;
  queryActions: QueryActions<Definitions, any>;
  unsubscribeQueryResult: UnsubscribeQueryResult;
  mutationSelectors: MutationResultSelectors<Definitions, any>;
  mutationActions: MutationActions<Definitions, any>;
  unsubscribeMutationResult: UnsubscribeMutationResult;
}) {
  const hooks = Object.entries(endpointDefinitions).reduce((acc, [name, endpoint]) => {
    if (isQueryDefinition(endpoint)) {
      acc[name] = {
        useQuery: (args) => {
          const dispatch = useDispatch<ThunkDispatch<any, any, AnyAction>>();
          useEffect(() => {
            const promise = dispatch(queryActions[name](args));
            return () =>
              void dispatch(
                unsubscribeQueryResult({
                  endpoint: name,
                  serializedQueryArgs: (promise as any).arg.serializedQueryArgs,
                  requestId: (promise as any).requestId,
                })
              );
          }, [args, dispatch]);
          return useSelector(querySelectors[name](args));
        },
      };
    } else if (isMutationDefinition(endpoint)) {
      acc[name] = {
        useMutation: () => {
          const dispatch = useDispatch<ThunkDispatch<any, any, AnyAction>>();
          const [requestId, setRequestId] = useState<string>();

          const promiseRef = useRef<ReturnType<AsyncThunkAction<any, any, any>>>();

          useEffect(() => {
            return () => {
              if (promiseRef.current) {
                dispatch(
                  unsubscribeMutationResult({ endpoint: name, requestId: (promiseRef as any).current.requestId })
                );
              }
            };
          }, [dispatch]);

          const triggerMutation = useCallback(
            function (args) {
              let promise: ReturnType<AsyncThunkAction<any, any, any>>;
              batch(() => {
                if (promiseRef.current) {
                  dispatch(
                    unsubscribeMutationResult({ endpoint: name, requestId: (promiseRef as any).current.requestId })
                  );
                }
                promise = dispatch(mutationActions[name](args));
                promiseRef.current = promise;
                setRequestId((promise as any).requestId);
              });
              return promise!;
            },
            [dispatch]
          );

          return [triggerMutation, useSelector(mutationSelectors[name](requestId ?? ''))];
        },
      };
    }
    return acc;
  }, {} as Record<string, { useQuery: QueryHook<any> } | { useMutation: MutationHook<any> }>) as Hooks<Definitions>;

  return { hooks };
}
