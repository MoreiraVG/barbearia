const express = require('express');
const fs = require('fs').promises; // Utilizando a API de Promises nativa do Node
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ARQUIVO = path.join(__dirname, 'agendamentos.json');

// ---- Dados fixos (edite aqui os serviços, preços e barbeiros) ----
const SERVICOS = [
  { id: 1, nome: 'Corte', preco: 40 },
  { id: 2, nome: 'Barba', preco: 30 },
  { id: 3, nome: 'Corte + Barba', preco: 65 },
  { id: 4, nome: 'Sobrancelha', preco: 15 },
];

const BARBEIROS = [
  { id: 1, nome: 'Carlos' },
  { id: 2, nome: 'Rafael' },
  { id: 3, nome: 'Diego' },
];

// Horários de 09:00 às 17:00, de hora em hora
const HORARIOS = [];
for (let h = 9; h <= 17; h++) HORARIOS.push(String(h).padStart(2, '0') + ':00');

// ---- Middlewares ----
app.use(express.json());
app.use(express.static(path.join(__dirname, 'front')));

// Log simples de requisições no terminal
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString('pt-BR')}] ${req.method} ${req.url}`);
  next();
});

// ---- Funções de arquivo (Assíncronas) ----
async function lerAgendamentos() {
  try {
    const data = await fs.readFile(ARQUIVO, 'utf8');
    return JSON.parse(data);
  } catch (erro) {
    // Se o arquivo não existir ou o JSON for inválido, retorna array vazio
    return [];
  }
}

async function salvarAgendamentos(lista) {
  try {
    await fs.writeFile(ARQUIVO, JSON.stringify(lista, null, 2));
  } catch (erro) {
    console.error('Erro ao salvar agendamentos:', erro);
  }
}

// Inicializa o arquivo de banco de dados, se não existir
async function inicializarBanco() {
  try {
    await fs.access(ARQUIVO);
  } catch {
    await salvarAgendamentos([]);
    console.log('Arquivo agendamentos.json criado com sucesso.');
  }
}

function hoje() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

// ---- Rotas ----
app.get('/api/servicos', (req, res) => res.json(SERVICOS));
app.get('/api/barbeiros', (req, res) => res.json(BARBEIROS));

// Horários livres de um barbeiro em uma data
app.get('/api/horarios', async (req, res) => {
  const { data, barbeiro_id } = req.query;
  const agendamentos = await lerAgendamentos();
  
  const ocupados = agendamentos
    .filter((a) => a.data === data && a.barbeiro_id === Number(barbeiro_id))
    .map((a) => a.hora);
    
  res.json(HORARIOS.filter((h) => !ocupados.includes(h)));
});

// Listar agendamentos (do mais próximo ao mais distante)
app.get('/api/agendamentos', async (req, res) => {
  const agendamentos = await lerAgendamentos();
  
  const lista = agendamentos
    .sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora))
    .map((a) => ({
      ...a,
      servico: SERVICOS.find((s) => s.id === a.servico_id)?.nome,
      preco: SERVICOS.find((s) => s.id === a.servico_id)?.preco,
      barbeiro: BARBEIROS.find((b) => b.id === a.barbeiro_id)?.nome,
    }));
    
  res.json(lista);
});

// Criar agendamento
app.post('/api/agendamentos', async (req, res) => {
  const nome = (req.body.nome || '').trim();
  const telefone = (req.body.telefone || '').trim();
  const servico_id = Number(req.body.servico_id);
  const barbeiro_id = Number(req.body.barbeiro_id);
  const { data, hora } = req.body;

  if (!nome || !telefone) {
    return res.status(400).json({ erro: 'Informe nome e telefone.' });
  }
  if (!SERVICOS.some((s) => s.id === servico_id)) {
    return res.status(400).json({ erro: 'Serviço inválido.' });
  }
  if (!BARBEIROS.some((b) => b.id === barbeiro_id)) {
    return res.status(400).json({ erro: 'Barbeiro inválido.' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data || '') || data < hoje()) {
    return res.status(400).json({ erro: 'Escolha uma data válida (hoje ou futura).' });
  }
  if (!HORARIOS.includes(hora)) {
    return res.status(400).json({ erro: 'Horário inválido.' });
  }

  const lista = await lerAgendamentos();
  
  const ocupado = lista.some(
    (a) => a.data === data && a.hora === hora && a.barbeiro_id === barbeiro_id
  );
  
  if (ocupado) {
    return res.status(409).json({ erro: 'Esse horário já foi reservado. Escolha outro.' });
  }

  const novo = { id: Date.now(), nome, telefone, servico_id, barbeiro_id, data, hora };
  lista.push(novo);
  
  await salvarAgendamentos(lista);
  res.status(201).json(novo);
});

// Cancelar agendamento
app.delete('/api/agendamentos/:id', async (req, res) => {
  const agendamentos = await lerAgendamentos();
  const idBuscado = Number(req.params.id);
  
  const listaFiltrada = agendamentos.filter((a) => a.id !== idBuscado);
  
  await salvarAgendamentos(listaFiltrada);
  res.status(204).end();
});

// ---- Inicialização do Servidor ----
app.listen(PORT, async () => {
  await inicializarBanco();
  console.log(`💈 Servidor rodando em http://localhost:${PORT}`);
});