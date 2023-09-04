const express = require('express');
const app = express();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/projects', express.static('projects'));

// Armazenar informações de logs e instâncias em execução em objetos
const appLogs = {};
const appInstances = {};


app.listen(3000, () => {
  console.log('Server is running on port 3000');
});


mongoose.connect('mongodb://localhost/my_database', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Defina um modelo de dados para as informações da aplicação
const Application = mongoose.model('Application', {
  name: String,
  description: String,
  logs: [String],
});

// Outras configurações...

// Rota para criar uma nova aplicação
app.post('/createApp', async (req, res) => {
  try {
    const { name, description } = req.body;
    const newApp = new Application({ name, description, logs: [] });
    await newApp.save();
    res.status(201).send('Aplicação criada com sucesso.');
  } catch (error) {
    console.error('Erro ao criar a aplicação:', error);
    res.status(500).send('Erro ao criar a aplicação.');
  }
});

// Rota para adicionar logs a uma aplicação
app.post('/addLogs/:appId', async (req, res) => {
  try {
    const { appId } = req.params;
    const { logs } = req.body;
    const application = await Application.findById(appId);

    if (!application) {
      res.status(404).send('Aplicação não encontrada.');
      return;
    }

    application.logs.push(logs);
    await application.save();
    res.status(200).send('Logs adicionados com sucesso.');
  } catch (error) {
    console.error('Erro ao adicionar logs:', error);
    res.status(500).send('Erro ao adicionar logs.');
  }
});


app.post('/upload', upload.single('project'), (req, res) => {
  const zipFilePath = req.file.path;
  const projectFolder = path.join(__dirname, 'projects');

  fs.createReadStream(zipFilePath)
    .pipe(unzipper.Extract({ path: projectFolder }))
    .on('close', async () => {
      try {
        // Após a descompactação, colete informações sobre o projeto
        const projectInfo = {
          name: req.body.name, // Nome do projeto, pode ser um campo no formulário de upload
          description: req.body.description, // Descrição do projeto, pode ser um campo no formulário de upload
          // Outras informações do projeto, se necessário
        };

        // Crie um novo documento no MongoDB para representar o projeto
        const Project = mongoose.model('Project', {
          name: String,
          description: String,
          // Outros campos do modelo, se necessário
        });

        const newProject = new Project(projectInfo);

        // Salve as informações do projeto no MongoDB
        await newProject.save();

        // Exclua o arquivo .zip após a descompactação, se desejar
        fs.unlink(zipFilePath, (err) => {
          if (err) {
            console.error('Erro ao excluir o arquivo .zip:', err);
          }
        });

        res.status(200).send('Projeto descompactado, armazenado no MongoDB e informações salvas com sucesso.');
      } catch (err) {
        console.error('Erro ao processar o projeto:', err);
        res.status(500).send('Erro ao processar o projeto.');
      }
    })
    .on('error', (err) => {
      console.error('Erro ao descompactar o projeto:', err);
      res.status(500).send('Erro ao descompactar o projeto.');
    });
});


app.post('/start', (req, res) => {
  // Recupere o nome do projeto ou identificador da aplicação
  const appId = req.body.appId; // Certifique-se de ter um campo adequado no corpo da solicitação

  // Verifique se o arquivo package.json existe no diretório do projeto
  const packageJsonPath = path.join(__dirname, 'projects', appId, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    res.status(404).send(`Arquivo package.json não encontrado para a aplicação ${appId}`);
    return;
  }

  try {
    // Leia o arquivo package.json
    const packageJson = require(packageJsonPath);

    // Verifique se há um script de inicialização definido no package.json
    if (packageJson && packageJson.scripts && packageJson.scripts.start) {
      const startCommand = packageJson.scripts.start;

      // Inicie o aplicativo com o comando de inicialização do package.json
      const appProcess = spawn('npm', ['run', 'start'], {
        cwd: path.join(__dirname, 'projects', appId), // Defina o diretório de trabalho para o diretório do projeto
      });

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

      res.status(200).send(`Iniciando a aplicação ${appId}`);
    } else {
      res.status(400).send(`Nenhum script "start" definido no arquivo package.json da aplicação ${appId}`);
    }
  } catch (err) {
    console.error(`Erro ao ler o arquivo package.json para a aplicação ${appId}: ${err}`);
    res.status(500).send(`Erro ao iniciar a aplicação ${appId}`);
  }
});


// Rota para buscar logs de uma aplicação com base no appId
app.get('/logs/:appId', async (req, res) => {
  try {
    // Recupere o appId da URL da solicitação
    const appId = req.params.appId;

    // Crie um modelo MongoDB para os logs da aplicação
    const Log = mongoose.model('Log', {
      appId: String,
      logText: String,
    });

    // Consulte o banco de dados para buscar os logs da aplicação com base no appId
    const logs = await Log.find({ appId });

    // Feche a conexão com o MongoDB
    mongoose.connection.close();

    // Envie os logs encontrados como resposta
    res.status(200).json(logs);
  } catch (error) {
    console.error('Erro ao buscar logs:', error);
    res.status(500).send('Erro ao buscar logs da aplicação.');
  }
});


// Outras configurações...

// Rota para reiniciar uma aplicação com base no appId
app.post('/restart/:appId', async (req, res) => {
  try {
    // Recupere o appId da URL da solicitação
    const appId = req.params.appId;

    // Conecte-se ao seu banco de dados MongoDB
    mongoose.connect('mongodb://localhost:27017/seu-banco-de-dados', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Crie um modelo MongoDB para representar as informações do aplicativo
    const Application = mongoose.model('Application', {
      name: String,
      script: String, // Nome do arquivo de script a ser executado
      // Outros campos do modelo, se necessário
    });

    // Consulte o banco de dados para buscar informações do aplicativo com base no appId
    const applicationInfo = await Application.findOne({ _id: appId });

    if (!applicationInfo) {
      res.status(404).send(`Aplicação com appId ${appId} não encontrada.`);
      return;
    }

    // Verifique se há uma instância em execução para esta aplicação
    if (appInstances[appId]) {
      // Encerre a instância anterior
      appInstances[appId].kill();

      // Remova os logs antigos associados a esta aplicação
      delete appLogs[appId];
    }

    // Inicie uma nova instância da aplicação com base nas informações do aplicativo
    const appProcess = spawn('node', ['projects/' + appId + '/' + applicationInfo.script]);

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

    // Feche a conexão com o MongoDB
    mongoose.connection.close();

    res.status(200).send(`Reiniciando a aplicação ${appId}`);
  } catch (error) {
    console.error('Erro ao reiniciar a aplicação:', error);
    res.status(500).send('Erro ao reiniciar a aplicação.');
  }
});


// Rota para parar uma aplicação com base no appId
app.post('/stop/:appId', async (req, res) => {
  try {
    // Recupere o appId da URL da solicitação
    const appId = req.params.appId;

    // Crie um modelo MongoDB para representar as informações do aplicativo
    const Application = mongoose.model('Application', {
      name: String,
      script: String, // Nome do arquivo de script a ser executado
      isRunning: Boolean, // Indicador se a aplicação está em execução
      // Outros campos do modelo, se necessário
    });

    // Consulte o banco de dados para buscar informações do aplicativo com base no appId
    const applicationInfo = await Application.findOne({ _id: appId });

    if (!applicationInfo) {
      res.status(404).send(`Aplicação com appId ${appId} não encontrada.`);
      return;
    }

    // Verifique se a aplicação está em execução
    if (applicationInfo.isRunning) {
      // Encerre a instância da aplicação
      const appProcess = appInstances[appId];
      appProcess.kill();

      // Atualize o status da aplicação para não em execução
      await Application.updateOne({ _id: appId }, { isRunning: false });

      // Remova a instância e os logs associados a esta aplicação
      delete appInstances[appId];
      delete appLogs[appId];

      // Feche a conexão com o MongoDB
      mongoose.connection.close();

      res.status(200).send(`Aplicação ${appId} foi parada.`);
    } else {
      res.status(400).send(`Aplicação ${appId} já está parada.`);
    }
  } catch (error) {
    console.error('Erro ao parar a aplicação:', error);
    res.status(500).send('Erro ao parar a aplicação.');
  }
});

// Outras rotas e configurações...

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});


