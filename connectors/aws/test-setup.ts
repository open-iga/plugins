import { GenericContainer, type StartedTestContainer } from 'testcontainers';

// Ryuk bind-mounts the Docker socket into a helper container
// Docker socket (~/.rd/docker.sock) can't be bind-mounted, so Ryuk fails with a 500
// Disable it with the env since the containers are still cleaned up by the afterAll block
process.env.TESTCONTAINERS_RYUK_DISABLED ??= 'true';

let ministack: StartedTestContainer;

console.log('Preload script started');
beforeAll(async () => {
    const startTIme = performance.now();
    console.log('Setting up MiniStack using testcontainers');
    ministack = await new GenericContainer('ministackorg/ministack:1.5').withExposedPorts(4566).start();

    console.log(`MiniStack through testcontainers started in ${Math.ceil((performance.now() - startTIme) / 1_000)}s`);
    process.env.AWS_ENDPOINT_URL = `http://localhost:${ministack.getMappedPort(4566)}`;
}, 300_000);

afterAll(async () => {
    await ministack.stop();
}, 60_000);
