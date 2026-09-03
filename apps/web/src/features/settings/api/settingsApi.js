/**
 * The calls the Settings screen makes.
 *
 * Profile reads and writes are shared - onboarding writes the same record, and
 * the category hook that expenses and budgets use reads from it - so they live
 * in shared/api. Password changes belong to auth. This gathers the handful
 * this feature actually uses into one place, so a card imports one thing
 * rather than reaching across the app for each call.
 */

import profileApi from '../../../shared/api/profileApi';
import { authApi } from '../../auth';

const settingsApi = {
  /** Name, pocket money, currency, university, hostel. */
  updateProfile: (values) => profileApi.update(values),

  /** Every expense, goal, budget and chat message, as a JSON download. */
  exportData: () => profileApi.exportData(),

  /** Requires the current password: a stolen token alone must not wipe an account. */
  deleteAccount: (password) => profileApi.deleteAccount(password),

  /** Signs every other device out as a side effect. */
  changePassword: (currentPassword, newPassword) =>
    authApi.changePassword(currentPassword, newPassword),
};

export default settingsApi;
