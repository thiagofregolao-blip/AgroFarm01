import express from 'express';
const app = express();
app.use(express.json({limit: '50mb'}));
app.post('/webhook', (req, res) => {
  console.log("== WEBHOOK RECEIVED ==");
  console.log(JSON.stringify(req.body, null, 2));
  res.send('ok');
});
app.listen(3015, () => console.log('Listening on 3015'));
