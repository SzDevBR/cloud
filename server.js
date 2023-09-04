const express = require('express');
const app = express();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const { spawn } = require('child_process');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/projects', express.static('projects'));

// Armazenar informações de logs e instâncias em execução em objetos
const appLogs = {};
const appInstances = {};


app.listen(3000, () => {
  console.log('Server is running on port 3000');
});

const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/my_database', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

app.post('/upload', upload.single('project'), (req, res) => {
  const zipFilePath = req.file.path;
  const projectFolder = path.join(__dirname, 'projects');

  fs.createReadStream(zipFilePath)
    .pipe(unzipper.Extract({ path: projectFolder }))
    .on('close', () => {
      // O projeto foi descompactado com sucesso
      // Você pode adicionar qualquer lógica adicional aqui

      // Exclua o arquivo .zip após a descompactação, se desejar
      fs.unlink(zipFilePath, (err) => {
        if (err) {
          console.error('Erro ao excluir o arquivo .zip:', err);
        }
      });

      res.status(200).send('Projeto descompactado e armazenado com sucesso.');
    })
    .on('error', (err) => {
      console.error('Erro ao descompactar o projeto:', err);
      res.status(500).send('Erro ao descompactar o projeto.');
    });
});

// Rota para iniciar uma aplicação e redirecionar os logs para appLogs
app.post('/start', (req, res) => {
  // Recupere o nome do projeto ou identificador da aplicação
  const appId = req.body.appId; // Certifique-se de ter um campo adequado no corpo da solicitação

  // Lógica para iniciar a aplicação
  const appProcess = spawn('node', ['projects/' + appId + '/server.js']);

  appLogs[appId] = ''; // Inicializa os logs para esta aplicação

  appProcess.stdout.on('data', (data) => {
    console.log(`Saída do aplicativo ${appId}: ${data}`);
    appLogs[appId] += data.toString(); // Adiciona os logs à variável appLogs
  });

  appProcess.stderr.on('data', (data) => {
    console.error(`Erro no aplicativo ${appId}: ${data}`);
    appLogs[appId] += data.toString(); // Adiciona os logs de erro à variável appLogs
  });

  appProcess.on('close', (code) => {
    console.log(`Aplicativo ${appId} encerrado com código ${code}`);
  });

  res.status(200).send(`Iniciando a aplicação ${appId}`);
});


app.get('/logs/:appId', (req, res) => {
  // Recupere o nome do projeto ou identificador da aplicação
  const appId = req.params.appId; // Certifique-se de usar o mesmo nome de parâmetro definido na rota

  // Verifique se a aplicação está registrando logs
  if (!appLogs[appId]) {
    res.status(404).send(`Logs não encontrados para a aplicação ${appId}`);
    return;
  }

  // Envie os logs da aplicação como resposta
  res.status(200).send(appLogs[appId]);
});

const express = require('express');
const app = express();
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Armazenar informações de logs e instâncias em execução em objetos
const appLogs = {};
const appInstances = {};

// Outras configurações...

app.post('/restart/:appId', (req, res) => {
  // Recupere o nome do projeto ou identificador da aplicação
  const appId = req.params.appId; // Certifique-se de usar o mesmo nome de parâmetro definido na rota

  // Lógica para reiniciar a aplicação

  // Verifique se há uma instância em execução para esta aplicação
  if (appInstances[appId]) {
    // Encerre a instância anterior
    appInstances[appId].kill();

    // Remova os logs antigos associados a esta aplicação
    delete appLogs[appId];
  }

  // Inicie uma nova instância da aplicação
  const appProcess = spawn('node', ['projects/' + appId + '/server.js']);

  appLogs[appId] = ''; // Inicializa os logs para esta aplicação

  appProcess.stdout.on('data', (data) => {
    console.log(`Saída do aplicativo ${appId}: ${data}`);
    appLogs[appId] += data.toString(); // Adiciona os logs à variável appLogs
  });

  appProcess.stderr.on('data', (data) => {
    console.error(`Erro no aplicativo ${appId}: ${data}`);
    appLogs[appId] += data.toString(); // Adiciona os logs de erro à variável appLogs
  });

  appProcess.on('close', (code) => {
    console.log(`Aplicativo ${appId} encerrado com código ${code}`);
  });

  // Salve a instância em execução
  appInstances[appId] = appProcess;

  res.status(200).send(`Reiniciando a aplicação ${appId}`);
});

app.post('/stop/:appId', (req, res) => {
  // Recupere o nome do projeto ou identificador da aplicação
  const appId = req.params.appId; // Certifique-se de usar o mesmo nome de parâmetro definido na rota

  // Lógica para parar a aplicação

  // Verifique se há uma instância em execução para esta aplicação
  if (appInstances[appId]) {
    // Encerre a instância
    appInstances[appId].kill();
    
    // Remova a instância e os logs associados a esta aplicação
    delete appInstances[appId];
    delete appLogs[appId];

    res.status(200).send(`Aplicação ${appId} foi parada.`);
  } else {
    res.status(404).send(`Aplicação ${appId} não está em execução.`);
  }
});

// Outras rotas e configurações...

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});


