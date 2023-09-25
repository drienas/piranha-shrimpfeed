if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

if (!process.env.RMQSTRING) throw `No RabbitMQ Connection String`;
const RMQSTRING = process.env.RMQSTRING;
if (!process.env.QUEUE) throw `No Queue to listen to`;
const QUEUE = process.env.QUEUE;

function generateUuid() {
  return (
    Math.random().toString() +
    Math.random().toString() +
    Math.random().toString()
  );
}

const amqp = require("amqplib/callback_api");
const cors = require("cors");
const express = require("express");
const morgan = require("morgan");

const app = express();
app.use(cors());
app.use(morgan("[:date] :method :url :status - :response-time ms"));

app.get("/", (req, res) => {
  const id = req.query.customer;

  if (!id) {
    return res.status(400).send("Customer ID is required.");
  }

  amqp.connect(RMQSTRING, function (error0, connection) {
    if (error0) {
      throw error0;
    }
    connection.createChannel(function (error1, channel) {
      if (error1) {
        throw error1;
      }
      channel.assertQueue("", { exclusive: true }, function (error2, q) {
        if (error2) {
          throw error2;
        }
        const correlationId = generateUuid();
        console.log(" [x] Sending ID to backend", id);

        channel.consume(
          q.queue,
          function (msg) {
            if (msg.properties.correlationId == correlationId) {
              const c = JSON.parse(msg.content.toString());
              setTimeout(function () {
                connection.close();
                res.json(c);
              }, 500);
            }
          },
          { noAck: true }
        );

        channel.sendToQueue(QUEUE, Buffer.from(id), {
          correlationId: correlationId,
          replyTo: q.queue,
        });
      });
    });
  });
});

app.listen(3333, () => console.log(`App listening on port 3333`));
