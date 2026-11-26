CREATE OR REPLACE PROCEDURE MEDICARE_CMP_RUN_BATCH_NEW (
  P_RUN_ID       IN NUMBER,
  P_BATCH_NBR    IN VARCHAR2,
  P_REFRESH_DATA IN VARCHAR2 DEFAULT 'N',
  P_PARALLEL_DEG IN NUMBER DEFAULT 8,     -- must be <= JOB_QUEUE_PROCESSES
  P_CHUNK_SIZE   IN NUMBER DEFAULT 2500   -- bills per chunk
) AS
  V_BATCH_NBR      NUMBER;
  V_REFRESH        VARCHAR2(1) := UPPER(NVL(
    TRIM(P_REFRESH_DATA),
    'N'
  ));
  V_CHUNK_SIZE     NUMBER := GREATEST(
    NVL(
      P_CHUNK_SIZE,
      2500
    ),
    1
  );
  V_TASK_NAME      VARCHAR2(128);
  V_CHUNK_SQL      VARCHAR2(4000);
  V_EXEC_SQL       VARCHAR2(4000);
  V_EXISTS         NUMBER;
  V_BILL_CNT       NUMBER;
  V_TASK_STATUS    NUMBER;
  V_FAILED_CHUNKS  NUMBER;
  V_INVOICES_MED   NUMBER;
  V_TOTAL_ORMB     NUMBER;
  V_TOTAL_CMP      NUMBER;
  V_CURRENT_STATUS VARCHAR2(100);
  V_ERROR_MSG      VARCHAR2(4000);
  V_LOAD_STARTED   BOOLEAN := FALSE;  -- only purge data this call wrote

  PROCEDURE SET_RUN_STATUS (
    P_STATUS             IN VARCHAR2,
    P_STEP               IN VARCHAR2 DEFAULT NULL,
    P_NEXT_STEP          IN VARCHAR2 DEFAULT NULL,
    P_ERROR              IN VARCHAR2 DEFAULT NULL,
    P_INVOICES_MED       IN NUMBER DEFAULT NULL,
    P_TOTAL_RECORDS_ORMB IN NUMBER DEFAULT NULL,
    P_TOTAL_COMPARE_MED  IN NUMBER DEFAULT NULL
  ) IS
    PRAGMA AUTONOMOUS_TRANSACTION;
  BEGIN
    MERGE INTO COMPARE_OWNER.MEDICARE_CMP_RUN_STATUS S
    USING (
      SELECT P_RUN_ID AS RUN_ID,
             V_BATCH_NBR AS BATCH_NBR
        FROM DUAL
    ) X ON ( S.RUN_ID = X.RUN_ID
       AND S.BATCH_NBR = X.BATCH_NBR )
    WHEN MATCHED THEN UPDATE
    SET S.STATUS = P_STATUS,
        S.CURRENT_STEP = NVL(
      P_STEP,
      S.CURRENT_STEP
    ),
        S.NEXT_STEP = P_NEXT_STEP,
        S.ERROR_MESSAGE =
      CASE
        WHEN P_ERROR IS NOT NULL THEN
          SUBSTR(
            P_ERROR,
            1,
            1000
          )
        ELSE
          S.ERROR_MESSAGE
      END,
        S.INVOICES_MED = NVL(
      P_INVOICES_MED,
      S.INVOICES_MED
    ),
        S.TOTAL_RECORDS_ORMB = NVL(
      P_TOTAL_RECORDS_ORMB,
      S.TOTAL_RECORDS_ORMB
    ),
        S.TOTAL_COMPARE_MED = NVL(
      P_TOTAL_COMPARE_MED,
      S.TOTAL_COMPARE_MED
    ),
        S.LAST_UPDATE_TS = SYSTIMESTAMP,
        S.END_TS =
      CASE
        WHEN P_STATUS IN ( 'COMPLETE',
                           'ERROR',
                           'CANCELED' ) THEN
          SYSTIMESTAMP
        ELSE
          NULL
      END
    WHEN NOT MATCHED THEN
    INSERT (
      RUN_ID,
      BATCH_NBR,
      STATUS,
      CURRENT_STEP,
      NEXT_STEP,
      ERROR_MESSAGE,
      INVOICES_MED,
      TOTAL_RECORDS_ORMB,
      TOTAL_COMPARE_MED,
      START_TS,
      LAST_UPDATE_TS,
      END_TS )
    VALUES
      ( P_RUN_ID,
        V_BATCH_NBR,
        P_STATUS,
        P_STEP,
        P_NEXT_STEP,
        SUBSTR(
          P_ERROR,
          1,
          1000
        ),
        NVL(
          P_INVOICES_MED,
          0
        ),
        NVL(
          P_TOTAL_RECORDS_ORMB,
          0
        ),
        NVL(
          P_TOTAL_COMPARE_MED,
          0
        ),
        SYSTIMESTAMP,
        SYSTIMESTAMP,
        CASE
          WHEN P_STATUS IN ( 'COMPLETE',
                             'ERROR',
                             'CANCELED' ) THEN
            SYSTIMESTAMP
          ELSE
            NULL
        END
      );
    COMMIT;
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END SET_RUN_STATUS;

  FUNCTION GET_STATUS RETURN VARCHAR2 IS
    V_S VARCHAR2(100);
  BEGIN
    SELECT STATUS
      INTO V_S
      FROM COMPARE_OWNER.MEDICARE_CMP_RUN_STATUS
     WHERE RUN_ID = P_RUN_ID
       AND BATCH_NBR = V_BATCH_NBR;
    RETURN V_S;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RETURN NULL;
  END GET_STATUS;

  -- Committed chunks cannot be rolled back, so on failure/cancel we remove
  -- everything for the batch. This restores the original all-or-nothing
  -- behaviour and stops a later P_REFRESH_DATA='N' call from treating a
  -- partial load as "RESULTS ALREADY AVAILABLE".
  PROCEDURE PURGE_BATCH IS
  BEGIN
    DELETE FROM COMPARE_OWNER.MEDICARE_CMP_RESULTS
     WHERE BATCH_NBR = V_BATCH_NBR;
    DELETE FROM COMPARE_OWNER.MEDICARE_CMP_SOURCE_MED_XML
     WHERE BATCH_NBR = V_BATCH_NBR;
    DELETE FROM COMPARE_OWNER.MEDICARE_CMP_TARGET_ORMB
     WHERE BATCH_NBR = V_BATCH_NBR;
    COMMIT;
  END PURGE_BATCH;

  PROCEDURE CLEAN_WORK IS
  BEGIN
    DELETE FROM COMPARE_OWNER.MEDICARE_CMP_BILL_WORK
     WHERE RUN_ID = P_RUN_ID
       AND BATCH_NBR = V_BATCH_NBR;
    COMMIT;
  END CLEAN_WORK;

BEGIN
  IF P_RUN_ID IS NULL THEN
    RAISE_APPLICATION_ERROR(
      -20002,
      'P_RUN_ID must be provided'
    );
  END IF;
  V_BATCH_NBR := TO_NUMBER ( TRIM(P_BATCH_NBR) );
  V_TASK_NAME := 'MED_CMP_'
                 || P_RUN_ID
                 || '_'
                 || V_BATCH_NBR;
  IF V_REFRESH NOT IN ( 'Y',
                        'N' ) THEN
    SET_RUN_STATUS(
      'ERROR',
      'VALIDATION',
      NULL,
      'P_REFRESH_DATA must be Y or N'
    );
    RAISE_APPLICATION_ERROR(
      -20001,
      'P_REFRESH_DATA must be Y or N'
    );
  END IF;

  SET_RUN_STATUS(
    'IN_PROGRESS',
    'INITIALIZATION',
    'BUILD BILL WORK LIST'
  );
  IF V_REFRESH = 'N' THEN
    SELECT COUNT(*)
      INTO V_EXISTS
      FROM COMPARE_OWNER.MEDICARE_CMP_RESULTS
     WHERE BATCH_NBR = V_BATCH_NBR
       AND ROWNUM = 1;

    IF V_EXISTS > 0 THEN
      SET_RUN_STATUS(
        'COMPLETE',
        'RESULTS ALREADY AVAILABLE',
        NULL
      );
      RETURN;
    END IF;
  END IF;

  V_LOAD_STARTED := TRUE;
  IF V_REFRESH = 'Y' THEN
    PURGE_BATCH;
  END IF;

  --------------------------------------------------------------------
  -- 1. Bill work list with a numeric sequence.
  --    DBMS_PARALLEL_EXECUTE chunk ids are NUMBER; BILL_ID is VARCHAR2
  --    with leading zeros, so we chunk on BILL_SEQ instead of BILL_ID.
  --------------------------------------------------------------------
  CLEAN_WORK;
  INSERT INTO COMPARE_OWNER.MEDICARE_CMP_BILL_WORK (
    RUN_ID,
    BATCH_NBR,
    BILL_ID,
    BILL_SEQ
  )
    SELECT P_RUN_ID,
           V_BATCH_NBR,
           BILL_ID,
           ROW_NUMBER()
           OVER(
              ORDER BY BILL_ID
           )
      FROM (
      SELECT B.BILL_ID
        FROM KPMC_DOCMGMT_ADM.INDV_INVOICE_CONS_CTL B
       WHERE B.BATCH_NBR = V_BATCH_NBR
         AND B.BATCH_CD = 'CM-STMEX'
      UNION
      SELECT CES.BILL_ID
        FROM BILLING_OWNER.CM_EXTR_STM_BATCH_RUN SBR
        JOIN BILLING_OWNER.CM_EXTR_STM_DTL CES
      ON CES.STM_ID = SBR.STM_ID
       WHERE SBR.BATCH_NBR = V_BATCH_NBR
         AND SBR.BATCH_CD = 'CM-STMEX'
    );
  V_BILL_CNT := SQL%ROWCOUNT;
  COMMIT;
  IF V_BILL_CNT = 0 THEN
    CLEAN_WORK;
    SET_RUN_STATUS(
      'COMPLETE',
      'NO BILLS FOUND FOR BATCH',
      NULL,
      P_INVOICES_MED       => 0,
      P_TOTAL_RECORDS_ORMB => 0,
      P_TOTAL_COMPARE_MED  => 0
    );
    RETURN;
  END IF;

  DBMS_STATS.GATHER_TABLE_STATS(
    'COMPARE_OWNER',
    'MEDICARE_CMP_BILL_WORK'
  );
  SET_RUN_STATUS(
    'IN_PROGRESS',
    'CHUNKING '
    || V_BILL_CNT
    || ' BILLS',
    'DISPATCHING_WORKERS'
  );

  --------------------------------------------------------------------
  -- 2. Task + chunks of P_CHUNK_SIZE bills each
  --------------------------------------------------------------------
  BEGIN
    DBMS_PARALLEL_EXECUTE.DROP_TASK(V_TASK_NAME);
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;
  DBMS_PARALLEL_EXECUTE.CREATE_TASK(TASK_NAME => V_TASK_NAME);
  V_CHUNK_SQL := 'SELECT MIN(BILL_SEQ), MAX(BILL_SEQ)'
                 || '  FROM COMPARE_OWNER.MEDICARE_CMP_BILL_WORK'
                 || ' WHERE RUN_ID = '
                 || TO_CHAR(P_RUN_ID)
                 || '   AND BATCH_NBR = '
                 || TO_CHAR(V_BATCH_NBR)
                 || ' GROUP BY CEIL(BILL_SEQ / '
                 || TO_CHAR(V_CHUNK_SIZE)
                 || ')';

  DBMS_PARALLEL_EXECUTE.CREATE_CHUNKS_BY_SQL(
    TASK_NAME => V_TASK_NAME,
    SQL_STMT  => V_CHUNK_SQL,
    BY_ROWID  => FALSE
  );

  V_EXEC_SQL := 'BEGIN COMPARE_OWNER.MEDICARE_CMP_WORKER_CHUNK('
                || 'P_RUN_ID => '
                || TO_CHAR(P_RUN_ID)
                || ', '
                || 'P_BATCH_NBR => '
                || TO_CHAR(V_BATCH_NBR)
                || ', '
                || 'P_START_ID => :start_id, P_END_ID => :end_id); END;';

  SET_RUN_STATUS(
    'IN_PROGRESS',
    'PARALLEL_EXECUTION',
    'PROCESSING_CHUNKS'
  );

  --------------------------------------------------------------------
  -- 3. Run (blocks until all chunks are processed)
  --------------------------------------------------------------------
  DBMS_PARALLEL_EXECUTE.RUN_TASK(
    TASK_NAME      => V_TASK_NAME,
    SQL_STMT       => V_EXEC_SQL,
    LANGUAGE_FLAG  => DBMS_SQL.NATIVE,
    PARALLEL_LEVEL => P_PARALLEL_DEG
  );

  V_TASK_STATUS := DBMS_PARALLEL_EXECUTE.TASK_STATUS(V_TASK_NAME);

  -- User cancelled while chunks were running: workers skipped the rest
  IF GET_STATUS = 'CANCELED' THEN
    PURGE_BATCH;
    CLEAN_WORK;
    DBMS_PARALLEL_EXECUTE.DROP_TASK(V_TASK_NAME);
    RAISE_APPLICATION_ERROR(
      -20099,
      'Job canceled by user'
    );
  END IF;

  IF V_TASK_STATUS <> DBMS_PARALLEL_EXECUTE.FINISHED THEN
    SELECT COUNT(*)
      INTO V_FAILED_CHUNKS
      FROM USER_PARALLEL_EXECUTE_CHUNKS
     WHERE TASK_NAME = V_TASK_NAME
       AND STATUS = 'PROCESSED_WITH_ERROR';

    -- Capture the first chunk error before the task is dropped
    FOR R IN (
      SELECT ERROR_CODE,
             ERROR_MESSAGE,
             START_ID,
             END_ID
        FROM USER_PARALLEL_EXECUTE_CHUNKS
       WHERE TASK_NAME = V_TASK_NAME
         AND STATUS = 'PROCESSED_WITH_ERROR'
       ORDER BY CHUNK_ID
       FETCH FIRST 1 ROWS ONLY
    ) LOOP
      V_ERROR_MSG := V_FAILED_CHUNKS
                     || ' chunk(s) failed. First: BILL_SEQ '
                     || R.START_ID
                     || '-'
                     || R.END_ID
                     || ' ORA'
                     || R.ERROR_CODE
                     || ' '
                     || R.ERROR_MESSAGE;
    END LOOP;

    RAISE_APPLICATION_ERROR(
      -20010,
      SUBSTR(
        NVL(
          V_ERROR_MSG,
          'Task '
          || V_TASK_NAME
          || ' ended with status '
          || V_TASK_STATUS
        ),
        1,
        2000
      )
    );
  END IF;

  DBMS_PARALLEL_EXECUTE.DROP_TASK(V_TASK_NAME);
  CLEAN_WORK;

  --------------------------------------------------------------------
  -- 4. Metrics (same definitions as the original)
  --------------------------------------------------------------------
  SELECT COUNT(DISTINCT BILL_ID)
    INTO V_INVOICES_MED
    FROM COMPARE_OWNER.MEDICARE_CMP_SOURCE_MED_XML
   WHERE BATCH_NBR = V_BATCH_NBR;

  SELECT COUNT(DISTINCT BILL_ID)
    INTO V_TOTAL_ORMB
    FROM COMPARE_OWNER.MEDICARE_CMP_TARGET_ORMB
   WHERE BATCH_NBR = V_BATCH_NBR;

  SELECT COUNT(DISTINCT BILL_ID)
    INTO V_TOTAL_CMP
    FROM COMPARE_OWNER.MEDICARE_CMP_RESULTS
   WHERE RUN_ID = P_RUN_ID
     AND BATCH_NBR = V_BATCH_NBR;

  SET_RUN_STATUS(
    P_STATUS             => 'COMPLETE',
    P_STEP               => 'ALL INSERTIONS COMPLETED',
    P_NEXT_STEP          => NULL,
    P_INVOICES_MED       => V_INVOICES_MED,
    P_TOTAL_RECORDS_ORMB => V_TOTAL_ORMB,
    P_TOTAL_COMPARE_MED  => V_TOTAL_CMP
  );

EXCEPTION
  WHEN OTHERS THEN
    V_ERROR_MSG := SUBSTR(
      SQLERRM
      || ' | '
      || DBMS_UTILITY.FORMAT_ERROR_BACKTRACE,
      1,
      4000
    );
    ROLLBACK;
    IF V_LOAD_STARTED THEN
      BEGIN
        PURGE_BATCH;
      EXCEPTION
        WHEN OTHERS THEN
          NULL;
      END;
      BEGIN
        CLEAN_WORK;
      EXCEPTION
        WHEN OTHERS THEN
          NULL;
      END;
      BEGIN
        DBMS_PARALLEL_EXECUTE.DROP_TASK(V_TASK_NAME);
      EXCEPTION
        WHEN OTHERS THEN
          NULL;
      END;
    END IF;

    -- Same as original: do not overwrite a user cancel with ERROR
    V_CURRENT_STATUS := GET_STATUS;
    IF NVL(
      V_CURRENT_STATUS,
      'X'
    ) != 'CANCELED' THEN
      SET_RUN_STATUS(
        'ERROR',
        'FAILED',
        NULL,
        V_ERROR_MSG
      );
    END IF;
    RAISE;
END MEDICARE_CMP_RUN_BATCH_NEW;