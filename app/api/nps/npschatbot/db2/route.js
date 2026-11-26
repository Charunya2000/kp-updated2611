// #import { queryDB2 } from "@/utils/db2";

// export async function GET() {
//   try {
//     const rows = await queryDB2(
//       "SELECT * FROM ruw.rating_error FETCH FIRST 5 ROWS ONLY"
//     );

//     return Response.json({
//       success: true,
//       data: rows
//     });
//   } catch (err) {
//     return Response.json(
//       { success: false, error: err.message },
//       { status: 500 }
//     );
//   }
// }


export async function POST(req) {
  const { sql, params } = await req.json();

  const res = await fetch("http://10.15.37.135:4000/query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.DB2_BEARER_TOKEN}`
    },
    body: JSON.stringify({ sql })
  });

  const data = await res.json();
  return Response.json(data);
}

// import { queryDB2 } from "@/utils/db2";

// export async function POST(req) {
//     try {
//         // 1. Extract the SQL query and params from the incoming POST request
//         const body = await req.json();
//         const sql = body.sql;
//         const params = body.params || [];

//         // 2. Hit the database directly using your existing utility
//         const rows = await queryDB2(sql, params);

//         // 3. Return the data in the format your application expects ({ data: [...] })
//         return Response.json({ data: rows });

//     } catch (err) {
//         console.error("[DB2 Route Error]:", err.message);
//         return Response.json({ error: err.message }, { status: 500 });
//     }
// }

