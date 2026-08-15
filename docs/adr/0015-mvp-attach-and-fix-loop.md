# MVP first slice: attach-and-fix loop

The v1 end-to-end path is the "attach + fix" loop: attach a repository to a
conversation, chat, the engine edits code in the sandbox, runs tests, and opens
a pull request. Building it first exercises sandbox + GitHub + engine wiring
end to end. Bootstrapping a brand-new project (create repo, build, push) is the
second slice.