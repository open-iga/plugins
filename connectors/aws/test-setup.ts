import { GenericContainer, type StartedTestContainer } from 'testcontainers';

// Ryuk bind-mounts the Docker socket into a helper container
// Docker socket (~/.rd/docker.sock) can't be bind-mounted, so Ryuk fails with a 500
// Disable it with the env since the containers are still cleaned up by the afterAll block
process.env.TESTCONTAINERS_RYUK_DISABLED ??= 'true';

let floci: StartedTestContainer;

console.log('Preload script started');
beforeAll(async () => {
    const startTIme = performance.now();
    console.log('Setting up Floci using testcontainers');
    floci = await new GenericContainer('floci/floci:1.7.0-compat').withExposedPorts(4566).start();

    console.log(`Floci through testcontainers started in ${Math.ceil((performance.now() - startTIme) / 1_000)}s`);
    process.env.FLOCI_ENDPOINT_URL = `http://localhost:${floci.getMappedPort(4566)}`;
}, 300_000);

afterAll(async () => {
    await floci.stop();
}, 60_000);
