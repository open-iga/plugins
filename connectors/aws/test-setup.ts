import { GenericContainer, type StartedTestContainer } from 'testcontainers';

console.log('Preload script started');

let floci: StartedTestContainer;
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
