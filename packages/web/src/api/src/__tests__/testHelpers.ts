import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApolloServer } from '@apollo/server';
import { resolvers } from '../resolvers/index';
import { prisma } from '../context';

const __dirname = dirname(fileURLToPath(import.meta.url));
const typeDefs = readFileSync(join(__dirname, '../../src/schema.graphql'), 'utf-8');

/** Create a test Apollo Server instance */
export function createTestServer() {
  return new ApolloServer({
    typeDefs,
    resolvers,
  });
}

/**
 * Execute a GraphQL query against the test server.
 * Context has no user (anonymous).
 */
export async function executeQuery(
  server: ApolloServer,
  query: string,
  variables?: Record<string, unknown>,
) {
  const response = await server.executeOperation(
    { query, variables },
    {
      contextValue: {
        db: prisma,
        user: null,
        req: null as any,
        res: null as any,
        login: async () => {},
        logout: async () => {},
        files: null as any,
      },
    },
  );

  const { body } = response as any;
  if (body.kind === 'single') {
    return body.singleResult;
  }
  return body;
}
