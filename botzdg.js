const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const express = require("express");
const { body, validationResult } = require("express-validator");
const qrcode = require("qrcode");
const http = require("http");
const fileUpload = require("express-fileupload");
const axios = require("axios");
const port = process.env.PORT || 8000;
const app = express();
const server = http.createServer(app);
const qrcode = require('qrcode-terminal');

app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);
app.use(
  fileUpload({
    debug: true,
  })
);

const client = new Client({
  authStrategy: new LocalAuth({ clientId: "bot-zdg" }),
  puppeteer: {
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process", // <- this one doesn't works in Windows
      "--disable-gpu",
    ],
  },
});

client.initialize();

client.on("qr", (qr) => {
  qrcode.generate(qr, {small: true});
});

client.on("ready", () => {
  console.log("Dispositivo pronto");
});

client.on("authenticated", () => {
  console.log("Autenticado");
});

client.on("auth_failure", function () {
  console.error("Falha na autenticação");
});

client.on("change_state", (state) => {
  console.log("Status de conexão: ", state);
});

client.on("disconnected", (reason) => {
  console.log("Cliente desconectado", reason);
  client.initialize();
});

// Send message
app.post(
  "/message",
  [body("number").notEmpty(), body("message").notEmpty()],
  async (req, res) => {
    const errors = validationResult(req).formatWith(({ msg }) => {
      return msg;
    });

    if (!errors.isEmpty()) {
      return res.status(422).json({
        status: false,
        message: errors.mapped(),
      });
    }

    if (client.info === undefined) {
      console.log("the system is not ready yet");
    } else {
      const number = req.body.number;
      const message = req.body.message;

      if (number.length > 15) {
        return res.status(400).json({
          status: false,
          message: "Número muito extenso",
        });
      }

      const numberZDG = number + "@c.us";

      const exists = await client.isRegisteredUser(numberZDG);

      if (exists) {
        client
          .sendMessage(numberZDG, message)
          .then((response) => {
            res.status(200).json({
              status: true,
              message: "Mensagem enviada",
              response: response,
            });
          })
          .catch((err) => {
            res.status(500).json({
              status: false,
              message: "Mensagem não enviada",
              response: err,
            });
            console.log(err);
          });
      } else {
        res.status(404).json({
          status: false,
          message: "Número não existe",
        });
      }
    }
  }
);

// Send media
app.post(
  "/media",
  [
    body("number").notEmpty(),
    body("caption").notEmpty(),
    body("file").notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req).formatWith(({ msg }) => {
      return msg;
    });

    if (!errors.isEmpty()) {
      return res.status(422).json({
        status: false,
        message: errors.mapped(),
      });
    }

    const number = req.body.number;
    const numberDDI = number.substr(0, 2);
    const numberDDD = number.substr(2, 2);
    const numberUser = number.substr(-8, 8);
    const caption = req.body.caption;
    const fileUrl = req.body.file;

    let mimetype;
    const attachment = await axios
      .get(fileUrl, {
        responseType: "arraybuffer",
      })
      .then((response) => {
        mimetype = response.headers["content-type"];
        return response.data.toString("base64");
      });

    const media = new MessageMedia(mimetype, attachment, "Media");

    if (numberDDI !== "55") {
      const numberZDG = number + "@c.us";
      client
        .sendMessage(numberZDG, media, { caption: caption })
        .then((response) => {
          res.status(200).json({
            status: true,
            message: "Imagem enviada",
            response: response,
          });
        })
        .catch((err) => {
          res.status(500).json({
            status: false,
            message: "Imagem não enviada",
            response: err.text,
          });
        });
    } else if (numberDDI === "55" && parseInt(numberDDD) <= 30) {
      const numberZDG = "55" + numberDDD + "9" + numberUser + "@c.us";
      client
        .sendMessage(numberZDG, media, { caption: caption })
        .then((response) => {
          res.status(200).json({
            status: true,
            message: "Imagem enviada",
            response: response,
          });
        })
        .catch((err) => {
          res.status(500).json({
            status: false,
            message: "não enviada",
            response: err.text,
          });
        });
    } else if (numberDDI === "55" && parseInt(numberDDD) > 30) {
      const numberZDG = "55" + numberDDD + numberUser + "@c.us";
      client
        .sendMessage(numberZDG, media, { caption: caption })
        .then((response) => {
          res.status(200).json({
            status: true,
            message: "Imagem enviada",
            response: response,
          });
        })
        .catch((err) => {
          res.status(500).json({
            status: false,
            message: "Imagem não enviada",
            response: err.text,
          });
        });
    }
  }
);

server.listen(port, function () {
  console.log("App running on *: " + port);
});
