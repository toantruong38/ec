const fs = require("fs");

const toJSON = (p) => {
  return new Promise((rs, rj) => {
    fs.readFile("./2.json", "utf8", (err, data) => {
      if (err) {
        rj(err);
      } else {
        rs(JSON.parse(data));
      }
    });
  }).catch((err) => {
    console.log(err);

    return null;
  });
};

const task1 = async () => {
  const json = await toJSON("./2.json");

  if (!json) {
    return;
  }

  const profileObj = json.included.find((obj) =>
    obj.entityUrn.includes("urn:li:fsd_profile:")
  );

  Object.keys(profileObj).forEach((k) => {
    const val = profileObj[k];
    if (k === "entityUrn" || typeof val !== "string") {
      return;
    }

    const matchedEntity = json.included.find((obj) => obj.entityUrn === val);

    if (!matchedEntity) {
      return;
    }

    const entityKeys = Object.keys(matchedEntity);

    const key = entityKeys.find((k) => k.includes("elements"));

    if (!key) {
      profileObj[k] = matchedEntity;
    } else {
      profileObj[k] = matchedEntity[key].map((v) =>
        json.included.find((obj) => obj.entityUrn === v)
      );
    }
  });

  fs.writeFile("./out.json", JSON.stringify(profileObj), () => {
    console.info("Please check out.json for answer");
  });
};

const task2 = async () => {
  const json = await toJSON("./2.json");

  const uniqueTypes = Array.from(
    new Set(
      json.included.map((obj) => {
        const splits = obj["$type"].split(".");

        return splits[splits.length - 1];
      })
    )
  );

  console.log(uniqueTypes);

  const groups = uniqueTypes.reduce((out = {}, type) => {
    if (!out[type]) {
      out[type] = [];
    }

    out[type].push(
      ...json.included.filter((obj) => {
        const splits = obj["$type"].split(".");

        return splits[splits.length - 1] === type;
      })
    );

    return out;
  }, {});

  console.log(groups);

  fs.writeFile("./out_2.json", JSON.stringify(groups), () => {
    console.info("Please check out_2.json for answer");
  });
};

const task2_1 = async () => {};

task2_1().catch(console.warn);
