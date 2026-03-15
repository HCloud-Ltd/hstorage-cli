import { Cli } from "incur";
import { folderShareCli } from "./commands/folder/share";
import { authCli } from "./commands/auth";
import { userCli } from "./commands/user";
import { folderCli } from "./commands/folder";
import { teamCli } from "./commands/team";
import { subscriptionCli } from "./commands/subscription";
import { sftpCli } from "./commands/sftp";
import { fileCli } from "./commands/file";
import { uploadCli } from "./commands/file/upload";
import { downloadCli } from "./commands/file/download";
import { authVars, requireAuth } from "./middleware/auth";

const cli = Cli.create("hcli", {
  description: "HStorage CLI - File management from the command line",
  version: "0.1.0",
  vars: authVars,
});

const fullFileCli = fileCli
  .command(uploadCli)
  .command(downloadCli)
  .use(requireAuth);

cli
  .command(authCli)
  .command(userCli.use(requireAuth))
  .command(fullFileCli)
  .command(folderCli.use(requireAuth))
  .command(folderShareCli.use(requireAuth))
  .command(teamCli.use(requireAuth))
  .command(subscriptionCli.use(requireAuth))
  .command(sftpCli.use(requireAuth));

if (import.meta.main) {
  cli.serve(undefined, {
    exit: (code) => {
      if (code !== 0) {
        process.stderr.write('\nIf you believe this is a bug, please create an issue at:\nhttps://github.com/HCloud-Ltd/hstorage-cli/issues\n')
      }
      process.exit(code)
    },
  })
}

export { cli };
