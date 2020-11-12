import { createApi, fetchBaseQuery } from '@rtk-incubator/simple-query/dist';

interface CountResponse {
    count: number;
}

export const counterApi = createApi({
    reducerPath: 'counterApi',
    baseQuery: fetchBaseQuery({
        baseUrl: '/',
    }),
    entityTypes: ['Counter'],
    endpoints: (build) => ({
        getError: build.query({
            query: (_: void) => '/error',
        }),
        getNetworkError: build.query({
            query: (_: void) => '/network-error',
        }),
        getHeaderError: build.query({
            query: (_: void) => '/mismatched-header-error',
        }),
        getAbsoluteTest: build.query<any, void>({
            query: () => ({
                url: 'https://mocked.data',
                params: {
                    hello: 'friend',
                },
            }),
        }),
        getCount: build.query<CountResponse, void>({
            query: () => ({
                url: `/count?=${'whydothis'}`,
                params: {
                    test: 'param',
                    additional: 1,
                },
            }),
            provides: ['Counter'],
        }),
        incrementCount: build.mutation<CountResponse, number>({
            query: (amount) => ({
                url: `/increment`,
                method: 'PUT',
                body: { amount },
            }),
            invalidates: ['Counter'],
        }),
        decrementCount: build.mutation<CountResponse, number>({
            query: (amount) => ({
                url: `decrement`,
                method: 'PUT',
                body: { amount },
            }),
            invalidates: ['Counter'],
        }),
        getCountById: build.query<CountResponse, number>({
            query: (id: number) => `${id}`,
            provides: (_, id) => [{ type: 'Counter', id }],
        }),
        incrementCountById: build.mutation<CountResponse, { id: number; amount: number }>({
            query: ({ id, amount }) => ({
                url: `${id}/increment`,
                method: 'PUT',
                body: { amount },
            }),
            invalidates: (_, { id }) => [{ type: 'Counter', id }],
        }),
        decrementCountById: build.mutation<CountResponse, { id: number; amount: number }>({
            query: ({ id, amount }) => ({
                url: `${id}/decrement`,
                method: 'PUT',
                body: { amount },
            }),
            invalidates: (_, { id }) => [{ type: 'Counter', id }],
        }),
    }),
});
