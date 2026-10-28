import { verifySecret } from "@/lib/passwords";
import { passwordProblem } from "@/lib/password-rules";

/**
 * The checks when a signed-in user chooses a new password: the current password must be right,
 * the new one strong and different. Returns the first problem, or null when the change may go on.
 */
export function passwordChangeProblem(input: {
  current: string;
  next: string;
  stored: string;
  personal?: readonly string[];
}) {
  if (!input.current) return "Enter your current password.";
  if (!verifySecret(input.current, input.stored))
    return "The current password is not correct.";
  if (input.next === input.current || verifySecret(input.next, input.stored)) {
    return "Choose a password that is different from the current one.";
  }
  return passwordProblem(input.next, input.personal ?? []);
}
