// Stands in for the "server-only" guard under test, which throws by design
// outside a server runtime. Repositories import it, and repositories are
// exactly what the integration tests exercise. See vitest.config.mts.
export {};
