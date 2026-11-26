'use server';


import { getOracleConnection } from '../../oracleService';

import oracledb from 'oracledb';

export async function queryOracleDB(sqlQuery, bindParams = []) {
  let connection;
  try {
    // const envName = process.env['envName'] || 'dev';
    // connection = await oracledb.getConnection({

    //   user: process.env[`host.${envName}-aiportal-web-2.bcs.oracle.user`],//process.env.BASE_ORACLE_USER
    //   password: process.env[`host.${envName}-aiportal-web-2.bcs.oracle.password`],//process.env.BASE_ORACLE_PASSWORD
    //   connectString: process.env[`host.${envName}-aiportal-web-2.bcs.oracle.dsn`]//process.env.BASE_ORACLE_DSN,
    // });
    connection = await getOracleConnection('BCS');

    const options = {
      outFormat: oracledb.OUT_FORMAT_OBJECT // Returns rows as JS objects instead of arrays
    };
    const result = await connection.execute(sqlQuery, bindParams, options);
    return result.rows;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) { }
    }
  }
}


export async function deleteRecords(sqlQuery, bindParams = []) {
  let connection;
  try {
    
    connection = await getOracleConnection('BCS');

    const options = {
      outFormat: oracledb.OUT_FORMAT_OBJECT 
    };
    const result = await connection.execute(sqlQuery, bindParams, options);
    return result;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) { }
    }
  }
}

