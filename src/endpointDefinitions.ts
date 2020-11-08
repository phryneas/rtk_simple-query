const resultType = Symbol();

export interface BaseEndpointDefinition<QueryArg, InternalQueryArgs, ResultType> {
  query(arg: QueryArg): InternalQueryArgs;
  postProcess?(baseQueryReturnValue: unknown): ResultType | Promise<ResultType>;
  [resultType]?: ResultType;
}

export enum DefinitionType {
  query = 'query',
  mutation = 'mutation',
}

export type GetResultDescriptionFn<EntityTypes extends string, ResultType, QueryArg> = (
  result: ResultType,
  arg: QueryArg
) => ReadonlyArray<EntityDescription<EntityTypes>>;

export type EntityDescription<EntityType> = { type: EntityType; id?: number | string };
export type ResultDescription<EntityTypes extends string, ResultType, QueryArg> =
  | ReadonlyArray<EntityDescription<EntityTypes>>
  | GetResultDescriptionFn<EntityTypes, ResultType, QueryArg>
  | ReadonlyArray<EntityTypes>;

export interface QueryDefinition<QueryArg, InternalQueryArgs, EntityTypes extends string, ResultType>
  extends BaseEndpointDefinition<QueryArg, InternalQueryArgs, ResultType> {
  type: DefinitionType.query;
  provides?: ResultDescription<EntityTypes, ResultType, QueryArg>;
  invalidates?: never;
}

export interface MutationDefinition<QueryArg, InternalQueryArgs, EntityTypes extends string, ResultType>
  extends BaseEndpointDefinition<QueryArg, InternalQueryArgs, ResultType> {
  type: DefinitionType.mutation;
  invalidates?: ResultDescription<EntityTypes, ResultType, QueryArg>;
  provides?: never;
}

export type EndpointDefinition<QueryArg, InternalQueryArgs, EntityTypes extends string, ResultType> =
  | QueryDefinition<QueryArg, InternalQueryArgs, EntityTypes, ResultType>
  | MutationDefinition<QueryArg, InternalQueryArgs, EntityTypes, ResultType>;

export type EndpointDefinitions = Record<string, EndpointDefinition<any, any, any, any>>;

export function isQueryDefinition(e: EndpointDefinition<any, any, any, any>): e is QueryDefinition<any, any, any, any> {
  return e.type === DefinitionType.query;
}

export function isMutationDefinition(
  e: EndpointDefinition<any, any, any, any>
): e is MutationDefinition<any, any, any, any> {
  return e.type === DefinitionType.mutation;
}

export type EndpointBuilder<InternalQueryArgs, EntityTypes extends string> = {
  query<ResultType, QueryArg>(
    definition: Omit<QueryDefinition<QueryArg, InternalQueryArgs, EntityTypes, ResultType>, 'type'>
  ): QueryDefinition<QueryArg, InternalQueryArgs, EntityTypes, ResultType>;
  mutation<ResultType, QueryArg>(
    definition: Omit<MutationDefinition<QueryArg, InternalQueryArgs, EntityTypes, ResultType>, 'type'>
  ): MutationDefinition<QueryArg, InternalQueryArgs, EntityTypes, ResultType>;
};

export function calculateProvidedBy<ResultType, QueryArg, D extends ResultDescription<string, ResultType, QueryArg>>(
  description: D | undefined,
  result: ResultType,
  queryArg: QueryArg
): readonly EntityDescription<string>[] {
  if (isFunction(description)) {
    return description(result, queryArg);
  }
  if (Array.isArray(description)) {
    return description;
  }
  return [];
}

function isFunction<T>(t: T): t is Extract<T, Function> {
  return typeof t === 'function';
}
