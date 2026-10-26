import { Link } from 'react-router-dom';
import { HiOutlineDatabase, HiOutlineExclamation, HiOutlineCheckCircle } from 'react-icons/hi';
import { backupAge, formatBackupDate } from '../../utils/backupAge';

const REMIND_AFTER_DAYS = 7;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * IPP-1008: "Last full backup: 3 days ago" on the admin dashboard.
 * Amber when there is no backup yet, it is older than 7 days, or someone got full access after it.
 * @param {{ lastBackup: null | { at, by, changesSince: { usersChanged, newPaid, questionsChanged, quizzes } } }} props
 */
export default function BackupReminder({ lastBackup }) {
  if (!lastBackup) {
    return (
      <Box warn title="No full backup yet" action="Download backup">
        Download a full backup (content, users, paid access, quiz results) and keep it somewhere safe.
      </Box>
    );
  }

  const age = backupAge(lastBackup.at);
  const { usersChanged = 0, newPaid = 0, questionsChanged = 0, quizzes = 0 } = lastBackup.changesSince || {};
  const changes = [
    newPaid && plural(newPaid, 'new paid user'),
    usersChanged && plural(usersChanged, 'user') + ' new or changed',
    questionsChanged && plural(questionsChanged, 'question') + ' added or edited',
    quizzes && plural(quizzes, 'quiz', 'quizzes') + ' taken',
  ].filter(Boolean);
  const old = age.days > REMIND_AFTER_DAYS;
  const warn = old || newPaid > 0;

  return (
    <Box
      warn={warn}
      title={`Last full backup: ${age.text}`}
      action={warn ? 'Download backup now' : 'Backup'}
    >
      <span className="block">
        {formatBackupDate(lastBackup.at)}
        {lastBackup.by ? ` · by ${lastBackup.by}` : ''}
      </span>
      <span className="block">
        {changes.length ? `Not in that backup yet: ${changes.join(', ')}.` : 'Nothing has changed since then.'}
        {old && ` Backups older than ${REMIND_AFTER_DAYS} days should be renewed.`}
      </span>
    </Box>
  );
}

function Box({ warn, title, action, children }) {
  const Icon = warn ? HiOutlineExclamation : HiOutlineCheckCircle;
  return (
    <section
      aria-label="Backup"
      className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5 ${
        warn ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'
      }`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Icon className={`mt-0.5 shrink-0 ${warn ? 'text-amber-600' : 'text-green-600'}`} size={24} />
        <div className="min-w-0">
          <p className={`font-semibold ${warn ? 'text-amber-900' : 'text-green-900'}`}>{title}</p>
          <p className={`mt-0.5 text-sm ${warn ? 'text-amber-800' : 'text-green-800'}`}>{children}</p>
        </div>
      </div>
      <Link
        to="/admin/backup"
        className={`inline-flex shrink-0 items-center justify-center gap-1.5 self-start rounded-md px-4 py-2 text-sm font-semibold sm:self-auto ${
          warn ? 'bg-amber-600 text-white hover:bg-amber-700' : 'border border-green-300 bg-white text-green-800 hover:bg-green-100'
        }`}
      >
        <HiOutlineDatabase size={16} /> {action}
      </Link>
    </section>
  );
}
