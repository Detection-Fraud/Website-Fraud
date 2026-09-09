const DEV_SEED_CONFIRMATION = "I_UNDERSTAND_DEV_SEED";
const DEV_SEED_FLAG = "--confirm-dev-seed";

export function assertDevelopmentSeedInvocation(
  env: NodeJS.ProcessEnv,
  args: readonly string[],
): void {
  if (
    env.NODE_ENV !== "development" ||
    env.SEED_CONFIRMATION !== DEV_SEED_CONFIRMATION ||
    !args.includes(DEV_SEED_FLAG)
  ) {
    throw new Error(
      `Refusing seed outside confirmed development invocation. Set NODE_ENV=development, SEED_CONFIRMATION=${DEV_SEED_CONFIRMATION}, and pass ${DEV_SEED_FLAG}.`,
    );
  }
}
