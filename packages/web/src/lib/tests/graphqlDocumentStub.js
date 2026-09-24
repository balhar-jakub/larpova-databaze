// Jest moduleNameMapper target for `*.graphql` imports (see jest.config.json).
// At runtime Next turns these into GraphQL documents via next-plugin-graphql;
// in component tests the document is only handed to Apollo, which the test
// mocks, so its contents never matter.
module.exports = {}
