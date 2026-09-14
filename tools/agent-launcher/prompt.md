Work on the university assignment tracked by Life Tracker to-do #{{TODO_ID}}. Do the work, but DO NOT SUBMIT IT.

1. **Read the to-do.** Call the life-tracker MCP tool `get_todo` with id {{TODO_ID}} to get its title and full notes.
2. **Find the assignment on LEARN** (brightspace MCP):
   - If the notes contain a `learn.uwaterloo.ca` link, use its ids (`ou=` is the course, `db=` is the dropbox folder) to find the assignment with `get_assignments`.
   - Otherwise use `list_my_courses` and `get_assignments` to find the assignment whose name best matches the to-do title.
   - If nothing matches, or several plausibly match, stop and ask me which one.
3. **Read everything relevant:** the full instructions, attached files (`get_assignment_files`), and any linked course content or announcements they depend on. Note the due date and the required submission format.
4. **Check the rules.** Read the course outline (`get_syllabus`) for its policy on AI assistance and collaboration. If AI help is not permitted for this assignment, stop and tell me what the policy says before doing any work.
5. **Set up the folder** `~/Desktop/UWaterloo/<course>/<assignment>`:
   - `<course>`: reuse an existing folder in `~/Desktop/UWaterloo` whose name matches the course code case-insensitively (e.g. `CS341`); otherwise use the lowercase code without spaces (e.g. `cs350`).
   - `<assignment>`: a short slug such as `a3` or `lab2`.
   - Save the instructions and attachments there, and keep all of your work inside that folder.
6. **Do the assignment** in that folder, in the format the instructions require. Explain your reasoning where it helps me review it.
7. **Never submit.** Do not upload to a dropbox, start or answer quizzes, post to discussions, send emails, or make any other change on LEARN. I will review and submit myself.
8. **Finish with a summary:** what you completed, the files you produced, anything uncertain or left undone, and exactly what I need to review and submit, with the due date.
