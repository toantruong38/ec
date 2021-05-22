const fs = require("fs");

const puppeteer = require("puppeteer-extra");

// Add stealth plugin and use defaults (all tricks to hide puppeteer usage)
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

const shutdownPopups = async (page) => {
  await page.evaluate(() => {
    Array.from(document.querySelectorAll("div[id*=ModalFocus]")).forEach(
      (el) => {
        const closeBtn = el.querySelector("button[class*=close]");

        if (closeBtn) {
          closeBtn.click();
        }
      }
    );
  });

  await page.waitForTimeout(1000);
};

const withEachMail = async (mail, page, browser) => {
  const newMsgBtn = await page.waitForXPath(
    "//span[contains(text(),'New message')]"
  );

  await newMsgBtn.click();

  await shutdownPopups(page).catch(console.warn);

  const mailReceiverInp = await page.waitForSelector(`input[aria-label=To]`, {
    visible: true,
  });

  await mailReceiverInp.type(mail, { delay: 100 });
  await page.waitForTimeout(500);

  await page.keyboard.press("Enter");

  for (;;) {
    await page.$eval("span[class*=wellItem]", (el) => el.click());

    const ok = await page
      .waitForSelector(`div[data-log-region="ImmersiveProfile"]`, {
        visible: true,
        timeout: 2000,
      })
      .then((_) => true)
      .catch((_) => false);

    if (ok) {
      break;
    }
  }
  const cleanupActs = async () => {
    //clean up
    await page.$eval(`button[aria-label="Close expanded profile view"]`, (el) =>
      el.click()
    );
    await page.waitForSelector(`div[data-log-region="ImmersiveProfile"]`, {
      hidden: true,
    });
    await page.$eval(`button[aria-label="Remove person"]`, (el) => el.click());
    await page.waitForSelector(`span[class*=wellItem]`, {
      hidden: true,
    });
  };

  const linkedInBtn = await page
    .waitForSelector(`button[name=LinkedIn]`, {
      visible: true,
      timeout: 15000,
    })
    .catch((_) => null);
  if (!linkedInBtn) {
    console.trace("No LinkedIn profile");

    await cleanupActs();

    return;
  }

  await linkedInBtn.click();

  const trigger = await page
    .waitForSelector(
      `button[aria-label="See full profile on LinkedIn. Opens in a new browser tab"]`,
      { visible: true, timeout: 3000 }
    )
    .catch((_) => null);
  if (!trigger) {
    console.trace("No Linked profile");

    await cleanupActs();

    return;
  }
  await trigger.click();

  await page.waitForTimeout(2000);
  const pages = await browser.pages();
  // console.log("pages length", pages.length);

  const linkedinPage = pages[pages.length - 1];

  const linkedinProfile = await linkedinPage.evaluate(
    () => window.location.href
  );

  console.log(`\n${mail} | ${linkedinProfile}\n`);

  //   console.log("End script");

  await linkedinPage.close();

  await cleanupActs();
};

const main = async () => {
  const userData = await new Promise((rs, rj) => {
    fs.readFile("./user_data.json", { encoding: "utf8" }, (err, data) => {
      if (err) {
        rj(err);
      } else {
        try {
          const json = JSON.parse(data);

          if (!(json["linkedIn"] && json["outlook"])) {
            rj(new Error("invalid data"));
          } else {
            rs(json);
          }
        } catch (err) {
          rj(err);
        }
      }
    });
  }).catch((err) => {
    console.log(err);

    return null;
  });

  const browser = await puppeteer
    .launch({
      headless: false,
      userDataDir: "./chrome",
      ignoreDefaultArgs: ["--enable-automation"],
    })
    .catch((err) => {
      console.log(err);

      return null;
    });

  if (!browser) {
    console.info("Couldn't init browser. Abort now");

    return;
  }

  const page = await browser.newPage();
  await page.goto("https://www.linkedin.com/");
  if (await page.evaluate(() => !window.location.href.includes("feed"))) {
    //not logged in

    if (!userData || userData.linkedIn.pwd === "placeholder") {
      console.info("Please log in to LinkedIn");

      await page.waitForFunction(() => window.location.href.includes("feed"), {
        timeout: 0,
      });
    } else {
      await page.$eval(
        `#session_key`,
        (el, userData) => (el.value = userData.linkedIn.usr),
        userData
      );

      await page.$eval(
        `#session_password`,
        (el, userData) => (el.value = userData.linkedIn.pwd),
        userData
      );

      await page.$eval(`button[type=submit]`, (el) => el.click());

      await page.waitForFunction(() => window.location.href.includes("feed"), {
        timeout: 0,
      });
    }
  }

  console.info("Logged in to LinkedIn");
  await page.close();

  const mailPage = await browser.newPage();

  await mailPage.goto("https://outlook.office.com/");

  const isLoggedIn = await mailPage.evaluate(
    () => window.location.href === "https://outlook.office.com/mail/inbox"
  );

  if (!isLoggedIn) {
    if (!userData || userData.outlook.pwd === "placeholder") {
      console.info("Wait for login outlook");

      await mailPage.waitForFunction(
        () => {
          return (
            window.location.href === "https://outlook.office.com/mail/inbox"
          );
        },
        { timeout: 0 }
      );
    } else {
      const mailInput = await mailPage.waitForSelector(`input[type=email]`, {
        visible: true,
      });

      await mailInput.type(userData.outlook.usr, { delay: 100 });

      await mailPage.$eval(`input[type=email]`, (el) => el.click());

      await mailPage.keyboard.press("Enter");

      const selection = await mailPage.waitForSelector(
        `div#bySelection>div[tabindex='1']`,
        { visible: true }
      );
      await selection.click();

      const pwdInput = await mailPage.waitForSelector(`input#passwordInput`, {
        visible: true,
      });
      await pwdInput.type(userData.outlook.pwd, { delay: 100 });

      await mailPage.$eval(`span#submitButton`, (el) => el.click());

      const stay = await mailPage.waitForSelector(`input#idSIButton9`, {
        visible: true,
      });
      await stay.click();

      await mailPage.waitForFunction(
        () => {
          return (
            window.location.href === "https://outlook.office.com/mail/inbox"
          );
        },
        { timeout: 0 }
      );
    }
  }

  console.log("Logged in");
  console.log("Processing...");

  const mails = [
    "luongsexy0072@gmail.com",
    "htkimchi@gmail.com",
    "resume.vn@farorecruitment.com",
    "thanhthi6215@gmail.com",
    "trangttt168@gmail.com",
    "hangngabui.191@gmail.com",
    "LinhNTD7@fsoft.com.vn",
    "nktung2711@gmail.com",
    "thachanh0311@gmail.com",
    "vutohatrang@gmail.com",
    "huykieu542@gmail.com",
  ];

  for (const mail of mails) {
    await withEachMail(mail, mailPage, browser);
  }
};

main().catch(console.warn);
