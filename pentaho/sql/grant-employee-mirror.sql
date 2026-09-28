\set ON_ERROR_STOP on

-- Usage:
-- psql -v pentaho_role='<operator-supplied-role>' -f grant-employee-mirror.sql

BEGIN;

REVOKE ALL ON SCHEMA pentaho_stage FROM :"pentaho_role";
GRANT USAGE ON SCHEMA pentaho_stage TO :"pentaho_role";

REVOKE ALL ON TABLE pentaho_stage.employee_mirror FROM PUBLIC;
REVOKE ALL ON TABLE pentaho_stage.employee_mirror FROM :"pentaho_role";
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE pentaho_stage.employee_mirror
TO :"pentaho_role";

COMMIT;
