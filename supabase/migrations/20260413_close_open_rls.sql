-- Close open RLS on legacy + active P3 tables

-- homework: legacy, deny-all
DROP POLICY IF EXISTS "authenticated access" ON homework;

-- milestones: legacy, deny-all
DROP POLICY IF EXISTS "authenticated access" ON milestones;

-- progress: legacy, deny-all
DROP POLICY IF EXISTS "authenticated access" ON progress;

-- todos: scope to own rows
DROP POLICY IF EXISTS "authenticated access" ON todos;
CREATE POLICY "users_manage_own_todos" ON todos
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- todo_reminders: scope to own todos
DROP POLICY IF EXISTS "authenticated access" ON todo_reminders;
CREATE POLICY "users_manage_own_todo_reminders" ON todo_reminders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM todos WHERE todos.id = todo_reminders.todo_id AND todos.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM todos WHERE todos.id = todo_reminders.todo_id AND todos.user_id = auth.uid())
  );
