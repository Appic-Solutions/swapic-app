// @wagmi/connectors' Base Account connector pulls in @coinbase/cdp-sdk, which imports its OPTIONAL x402 payment
// peers (@x402/core, @x402/evm, @x402/svm). Swapic never makes x402 payments and does not install them; next.config.mjs
// aliases the five specifiers the bundle reaches to this stub so the build resolves. Anything that calls it throws.
const absent = () => {
  throw new Error('x402 payments are not part of Swapic');
};
export const toClientEvmSigner = absent;
export const registerExactEvmScheme = absent;
export const registerExactSvmScheme = absent;
export class x402Client { constructor() { absent(); } }
export class UptoEvmScheme { constructor() { absent(); } }
export class ExactSvmScheme { constructor() { absent(); } }
