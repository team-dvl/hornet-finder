"""
Periodic jobs other apps add to the scheduler (`manage.py run_scheduler`), so
that `hornet` needs no knowledge of them: an app appends `(name, callable)` in
its `AppConfig.ready()` (see `apiculture/apps.py`). Each job is idempotent and
cheap when there is nothing to do: it runs every pass (10 minutes).
"""

JOBS: list = []
