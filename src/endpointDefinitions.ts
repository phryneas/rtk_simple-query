import { AnyAction, ThunkDispatch } from '@reduxjs/toolkit';
import { RootState } from './core/apiState';
import {
  BaseQueryExtraOptions,
  BaseQueryFn,
  BaseQueryResult,
  BaseQueryArg,
  BaseQueryApi,
  QueryReturnValue,
  BaseQueryError,
  BaseQueryMeta,
} from './baseQueryTypes';
import { HasRequiredProps, MaybePromise, OmitFromUnion, CastAny } from './tsHelpers';
import { NEVER } from './fakeBaseQuery';

const resultType = Symbol();
const baseQuery = Symbol();

export type BaseEndpointDefinition<QueryArg, BaseQuery extends BaseQueryFn, ResultType> = (
  | ([CastAny<BaseQueryResult<BaseQuery>, {}>] extends [NEVER]
      ? never
      : {
          query(arg: QueryArg): BaseQueryArg<BaseQuery>;
          queryFn?: never;
          transformResponse?(
            baseQueryReturnValue: BaseQueryResult<BaseQuery>,
            meta: BaseQueryMeta<BaseQuery>
          ): ResultType | Promise<ResultType>;
        })
  | {
      queryFn(
        arg: QueryArg,
        api: BaseQueryApi,
        extraOptions: BaseQueryExtraOptions<BaseQuery>,
        baseQuery: (arg: Parameters<BaseQuery>[0]) => ReturnType<BaseQuery>
      ): MaybePromise<QueryReturnValue<ResultType, BaseQueryError<BaseQuery>>>;
      query?: never;
      transformResponse?: never;
    }
) & {
  /* phantom type */
  [resultType]?: ResultType;
  /* phantom type */
  [baseQuery]?: BaseQuery;
} & HasRequiredProps<
    BaseQueryExtraOptions<BaseQuery>,
    { extraOptions: BaseQueryExtraOptions<BaseQuery> },
    { extraOptions?: BaseQueryExtraOptions<BaseQuery> }
  >;

export enum DefinitionType {
  query = 'query',
  mutation = 'mutation',
}

type GetResultDescriptionFn<EntityTypes extends string, ResultType, QueryArg, ErrorType> = (
  result: ResultType | undefined,
  error: ErrorType | undefined,
  arg: QueryArg
) => ReadonlyArray<EntityDescription<EntityTypes>>;

export type FullEntityDescription<EntityType> = { type: EntityType; id?: number | string };
type EntityDescription<EntityType> = EntityType | FullEntityDescription<EntityType>;
type ResultDescription<EntityTypes extends string, ResultType, QueryArg, ErrorType> =
  | ReadonlyArray<EntityDescription<EntityTypes>>
  | GetResultDescriptionFn<EntityTypes, ResultType, QueryArg, ErrorType>;

export interface QueryApi<ReducerPath extends string, Context extends {}> {
  dispatch: ThunkDispatch<any, any, AnyAction>;
  getState(): RootState<any, any, ReducerPath>;
  extra: unknown;
  requestId: string;
  context: Context;
}

export type QueryDefinition<
  QueryArg,
  BaseQuery extends BaseQueryFn,
  EntityTypes extends string,
  ResultType,
  ReducerPath extends string = string,
  Context = Record<string, any>
> = BaseEndpointDefinition<QueryArg, BaseQuery, ResultType> & {
  type: DefinitionType.query;
  provides?: ResultDescription<EntityTypes, ResultType, QueryArg, BaseQueryError<BaseQuery>>;
  invalidates?: never;
  onStart?(arg: QueryArg, queryApi: QueryApi<ReducerPath, Context>): void;
  onError?(
    arg: QueryArg,
    queryApi: QueryApi<ReducerPath, Context>,
    error: unknown,
    meta: BaseQueryMeta<BaseQuery>
  ): void;
  onSuccess?(
    arg: QueryArg,
    queryApi: QueryApi<ReducerPath, Context>,
    result: ResultType,
    meta: BaseQueryMeta<BaseQuery> | undefined
  ): void;
};

export interface MutationApi<ReducerPath extends string, Context extends {}> {
  dispatch: ThunkDispatch<any, any, AnyAction>;
  getState(): RootState<any, any, ReducerPath>;
  extra: unknown;
  requestId: string;
  context: Context;
}

export type MutationDefinition<
  QueryArg,
  BaseQuery extends BaseQueryFn,
  EntityTypes extends string,
  ResultType,
  ReducerPath extends string = string,
  Context = Record<string, any>
> = BaseEndpointDefinition<QueryArg, BaseQuery, ResultType> & {
  type: DefinitionType.mutation;
  invalidates?: ResultDescription<EntityTypes, ResultType, QueryArg, BaseQueryError<BaseQuery>>;
  provides?: never;
  onStart?(arg: QueryArg, mutationApi: MutationApi<ReducerPath, Context>): void;
  onError?(
    arg: QueryArg,
    mutationApi: MutationApi<ReducerPath, Context>,
    error: unknown,
    meta: BaseQueryMeta<BaseQuery>
  ): void;
  onSuccess?(
    arg: QueryArg,
    mutationApi: MutationApi<ReducerPath, Context>,
    result: ResultType,
    meta: BaseQueryMeta<BaseQuery> | undefined
  ): void;
};

export type EndpointDefinition<
  QueryArg,
  BaseQuery extends BaseQueryFn,
  EntityTypes extends string,
  ResultType,
  ReducerPath extends string = string
> =
  | QueryDefinition<QueryArg, BaseQuery, EntityTypes, ResultType, ReducerPath>
  | MutationDefinition<QueryArg, BaseQuery, EntityTypes, ResultType, ReducerPath>;

export type EndpointDefinitions = Record<string, EndpointDefinition<any, any, any, any>>;

export function isQueryDefinition(e: EndpointDefinition<any, any, any, any>): e is QueryDefinition<any, any, any, any> {
  return e.type === DefinitionType.query;
}

export function isMutationDefinition(
  e: EndpointDefinition<any, any, any, any>
): e is MutationDefinition<any, any, any, any> {
  return e.type === DefinitionType.mutation;
}

export type EndpointBuilder<BaseQuery extends BaseQueryFn, EntityTypes extends string, ReducerPath extends string> = {
  query<ResultType, QueryArg>(
    definition: OmitFromUnion<QueryDefinition<QueryArg, BaseQuery, EntityTypes, ResultType>, 'type'>
  ): QueryDefinition<QueryArg, BaseQuery, EntityTypes, ResultType>;
  mutation<ResultType, QueryArg, Context = Record<string, any>>(
    definition: OmitFromUnion<
      MutationDefinition<QueryArg, BaseQuery, EntityTypes, ResultType, ReducerPath, Context>,
      'type'
    >
  ): MutationDefinition<QueryArg, BaseQuery, EntityTypes, ResultType, ReducerPath, Context>;
};

export type AssertEntityTypes = <T extends FullEntityDescription<string>>(t: T) => T;

export function calculateProvidedBy<ResultType, QueryArg, ErrorType>(
  description: ResultDescription<string, ResultType, QueryArg, ErrorType> | undefined,
  result: ResultType | undefined,
  error: ErrorType | undefined,
  queryArg: QueryArg,
  assertEntityTypes: AssertEntityTypes
): readonly FullEntityDescription<string>[] {
  if (isFunction(description)) {
    return description(result as ResultType, error as undefined, queryArg)
      .map(expandEntityDescription)
      .map(assertEntityTypes);
  }
  if (Array.isArray(description)) {
    return description.map(expandEntityDescription).map(assertEntityTypes);
  }
  return [];
}

function isFunction<T>(t: T): t is Extract<T, Function> {
  return typeof t === 'function';
}

function expandEntityDescription(description: EntityDescription<string>): FullEntityDescription<string> {
  return typeof description === 'string' ? { type: description } : description;
}

export type QueryArgFrom<D extends BaseEndpointDefinition<any, any, any>> = D extends BaseEndpointDefinition<
  infer QA,
  any,
  any
>
  ? QA
  : unknown;
export type ResultTypeFrom<D extends BaseEndpointDefinition<any, any, any>> = D extends BaseEndpointDefinition<
  any,
  any,
  infer RT
>
  ? RT
  : unknown;

export type ReducerPathFrom<D extends EndpointDefinition<any, any, any, any>> = D extends EndpointDefinition<
  any,
  any,
  any,
  infer RP
>
  ? RP
  : unknown;

export type EntityTypesFrom<D extends EndpointDefinition<any, any, any, any>> = D extends EndpointDefinition<
  any,
  any,
  infer RP,
  any
>
  ? RP
  : unknown;

export type ReplaceEntityTypes<Definitions extends EndpointDefinitions, NewEntityTypes extends string> = {
  [K in keyof Definitions]: Definitions[K] extends QueryDefinition<
    infer QueryArg,
    infer BaseQuery,
    any,
    infer ResultType,
    infer ReducerPath
  >
    ? QueryDefinition<QueryArg, BaseQuery, NewEntityTypes, ResultType, ReducerPath>
    : Definitions[K] extends MutationDefinition<
        infer QueryArg,
        infer BaseQuery,
        any,
        infer ResultType,
        infer ReducerPath
      >
    ? MutationDefinition<QueryArg, BaseQuery, NewEntityTypes, ResultType, ReducerPath>
    : never;
};
