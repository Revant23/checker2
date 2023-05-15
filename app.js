const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();

app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3003, () => {
      console.log("Server Running at http://localhost:3003/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(-1);
  }
};
initializeDBAndServer();

const convertDbObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

const authenticationToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};
//API 1
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 2
app.get("/states/", authenticationToken, async (request, response) => {
  const getAllStatesQuery = `
    SELECT
    *
    FROM
    state;`;

  const AllStates = await db.all(getAllStatesQuery);
  response.send(
    AllStates.map((eachState) => convertDbObjectToResponseObject(eachState))
  );
});

//API 3
app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  const { stateId } = request.params;

  const getStateQuery = `
    SELECT
    *
    FROM
    state
    WHERE
    state_id = ${stateId};`;

  const State = await db.all(convertDbObjectToResponseObject(getStateQuery));
  response.send(State);
});

//API 4
app.post("/districts/", authenticationToken, async (request, response) => {
  const {
    districtId,
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = request.body;
  const postDistrictsQuery = `
    INSERT INTO 
    district(district_id,district_name,state_id,cases,cured,active,deaths)
    VALUES 
    (
        '${districtId}',
        '${districtName}',
        '${stateId}',
        '${cases}',
        '${cured}',
        '${active}',
        '${deaths}'
    );`;
  await db.run(postDistrictsQuery);
  response.send("District Successfully Added");
});

//API 5
app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;

    const getDistrictQuery = `
    SELECT
    *
    FROM
    district
    WHERE
    district_id = ${districtId};`;
    const District = await db.get(getDistrictQuery);
    response.send(convertDbObjectToResponseObject(District));
  }
);
//API 6
app.delete(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;

    const DeleteDistrictQuery = `
    DELETE FROM
    district
    WHERE
    district_id = ${districtId};`;
    await db.run(DeleteDistrictQuery);
    response.send("District Removed");
  }
);

//API 7
app.put(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const UpdateDistrictQuery = `
 INSERT INTO
 district (district_name,state_id,cases,cured,active,deaths)
 VALUES (
     '${districtName}',
     '${stateId}',
     '${cases}',
     '${cured}',
     '${active}',
     '${deaths}'
 );`;
    await db.run(UpdateDistrictQuery);
    response.send("District Details Updated");
  }
);

//API 8
app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;

    const getStatsOfState = `
    SELECT 
    SUM(cases),
    SUM(cured),
    SUM(active),
    SUM(deaths)
    FROM 
     district
    WHERE
    state_id = ${stateId};`;
    const Stats = await db.get(getStatsOfState);
    response.send({
      totalCases: Stats["SUM(cases)"],
      totalCured: Stats["SUM(cured)"],
      totalActive: Stats["SUM(active)"],
      totalDeaths: Stats["SUM(deaths)"],
    });
  }
);

module.exports = app;
