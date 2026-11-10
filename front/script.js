const form = document.getElementById('form');
const campoNome = document.getElementById('nome');
const campoTelefone = document.getElementById('telefone');
const campoServico = document.getElementById('servico');
const campoBarbeiro = document.getElementById('barbeiro');
const campoData = document.getElementById('data');
const campoHora = document.getElementById('hora');
const msg = document.getElementById('msg');
const lista = document.getElementById('lista');
const vazio = document.getElementById('vazio');

function dinheiro(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dataBR(iso) {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

function mostrarMsg(texto, tipo) {
  msg.textContent = texto;
  msg.className = 'msg ' + tipo;
  msg.hidden = false;
  
  // Oculta a mensagem automaticamente após 4 segundos
  setTimeout(() => {
    msg.hidden = true;
  }, 4000);
}

function preencherSelect(select, itens, textoVazio) {
  select.innerHTML = '';
  if (itens.length === 0) {
    const op = new Option(textoVazio, '');
    select.appendChild(op);
    return;
  }
  // Adiciona opção vazia padrão se houver textoVazio para as listas principais
  if (textoVazio) {
    select.appendChild(new Option(textoVazio, ''));
  }
  itens.forEach((i) => select.appendChild(new Option(i.texto, i.valor)));
}

async function carregarOpcoes() {
  try {
    const [servicos, barbeiros] = await Promise.all([
      fetch('/api/servicos').then((r) => r.json()),
      fetch('/api/barbeiros').then((r) => r.json()),
    ]);

    preencherSelect(
      campoServico,
      servicos.map((s) => ({ valor: s.id, texto: `${s.nome} - ${dinheiro(s.preco)}` })),
      'Selecione um serviço'
    );
    preencherSelect(
      campoBarbeiro,
      barbeiros.map((b) => ({ valor: b.id, texto: b.nome })),
      'Selecione um barbeiro'
    );
  } catch (error) {
    console.error("Erro ao carregar opções:", error);
  }
}

// Atualiza os horários livres conforme data e barbeiro
async function carregarHorarios() {
  if (!campoData.value || !campoBarbeiro.value) {
    preencherSelect(campoHora, [], 'Escolha a data e barbeiro');
    return;
  }
  try {
    const url = `/api/horarios?data=${campoData.value}&barbeiro_id=${campoBarbeiro.value}`;
    const horarios = await fetch(url).then((r) => r.json());
    preencherSelect(
      campoHora,
      horarios.map((h) => ({ valor: h, texto: h })),
      horarios.length ? 'Selecione o horário' : 'Sem horários livres'
    );
  } catch (error) {
    console.error("Erro ao carregar horários:", error);
  }
}

async function carregarAgendamentos() {
  try {
    const agendamentos = await fetch('/api/agendamentos').then((r) => r.json());
    lista.innerHTML = '';

    agendamentos.forEach((a) => {
      const li = document.createElement('li');

      const info = document.createElement('div');
      info.className = 'info-agendamento';
      
      const titulo = document.createElement('strong');
      titulo.textContent = `${dataBR(a.data)} às ${a.hora} - ${a.nome}`;
      
      const detalhe = document.createElement('small');
      detalhe.textContent = `${a.servico} (${dinheiro(a.preco)}) com ${a.barbeiro}`;
      const contato = document.createElement('small');
      contato.textContent = `Contato: ${a.telefone}`;
      
      info.append(titulo, detalhe, contato);

      const botao = document.createElement('button');
      botao.className = 'cancelar';
      botao.innerHTML = '<i class="ph ph-trash"></i>'; // Ícone de lixeira em vez de texto
      botao.title = 'Cancelar agendamento';
      botao.addEventListener('click', () => cancelar(a.id));

      li.append(info, botao);
      lista.appendChild(li);
    });

    vazio.hidden = agendamentos.length > 0;
  } catch (error) {
    console.error("Erro ao carregar agendamentos:", error);
  }
}

async function cancelar(id) {
  if (!confirm('Deseja realmente cancelar este agendamento?')) return;
  
  try {
    await fetch(`/api/agendamentos/${id}`, { method: 'DELETE' });
    carregarAgendamentos();
    carregarHorarios();
  } catch (error) {
    alert("Erro ao cancelar o agendamento.");
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.hidden = true;

  try {
    const resposta = await fetch('/api/agendamentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: campoNome.value,
        telefone: campoTelefone.value,
        servico_id: campoServico.value,
        barbeiro_id: campoBarbeiro.value,
        data: campoData.value,
        hora: campoHora.value,
      }),
    });

    if (resposta.ok) {
      mostrarMsg('Agendamento confirmado!', 'ok');
      campoNome.value = '';
      campoTelefone.value = '';
      // Resetar selects
      campoHora.innerHTML = '';
      preencherSelect(campoHora, [], 'Escolha a data e barbeiro');
    } else {
      const dados = await resposta.json();
      mostrarMsg(dados.erro || 'Erro ao agendar.', 'erro');
    }

    carregarAgendamentos();
    carregarHorarios();
  } catch (error) {
    mostrarMsg('Erro de conexão com o servidor.', 'erro');
  }
});

campoData.addEventListener('change', carregarHorarios);
campoBarbeiro.addEventListener('change', carregarHorarios);

// Configuração Inicial
const d = new Date();
campoData.min = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
carregarOpcoes().then(carregarHorarios);
carregarAgendamentos();