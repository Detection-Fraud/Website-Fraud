const DEV_SEED_CONFIRMATION = "I_UNDERSTAND_DEV_SEED";
const DEV_SEED_FLAG = "--confirm-dev-seed";
const UAT_SEED_FLAG = "--uat-units-admin";
const UAT_SEED_CONFIRMATION = "I_UNDERSTAND_UAT_SEED";

export function assertUatUnitSeedInvocation(
  env: NodeJS.ProcessEnv,
  args: readonly string[],
): { username: string; password: string } {
  const username = env.UAT_ADMIN_USERNAME?.trim() ?? "";
  const password = env.UAT_ADMIN_PASSWORD ?? "";
  if (
    !args.includes(UAT_SEED_FLAG) ||
    args.includes(DEV_SEED_FLAG) ||
    env.UAT_SEED_CONFIRMATION !== UAT_SEED_CONFIRMATION ||
    !/^[A-Za-z0-9._-]{3,64}$/.test(username) ||
    password.length < 16
  ) {
    throw new Error(
      `Refusing UAT seed. Pass ${UAT_SEED_FLAG}, set UAT_SEED_CONFIRMATION=${UAT_SEED_CONFIRMATION}, UAT_ADMIN_USERNAME, and a UAT_ADMIN_PASSWORD of at least 16 characters.`,
    );
  }
  return { username, password };
}

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
