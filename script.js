window.addEventListener('load', adicionaListeners);

const btnValidar = document.getElementById('btn-validar');
const primeiraChave = document.getElementById('primeira-chave');
const segundaChave = document.getElementById('segunda-chave');
const campoArquivo = document.getElementById('arquivo');
const campoArquivoLabel = document.getElementById('arquivo-label');
const btnCloseMsg = document.getElementById('btn-close-msg');
const btnExportarCsv = document.getElementById('btn-exportar');
const btnImprimir = document.getElementById('btn-imprimir');
const cpfCount = document.getElementById('cpf-count');
let arryCpfValidos = [];
let tokenAutenticacao = '';

function adicionaListeners() {
    if (!btnValidar && !campoArquivo) return;

    btnValidar.addEventListener('click', validaCamposInformados);
    campoArquivo.addEventListener('change', setNomeCampoArquivo);
    btnCloseMsg.addEventListener('click', fechaMsg);
    btnExportarCsv.addEventListener('click', gerarArquivoCsv);
    btnImprimir.addEventListener('click', imprimirTabela);
}

function validaCamposInformados(event) {
    event.preventDefault();

    let campoInvalido = false;

    if (!primeiraChave || !segundaChave || !campoArquivo) return;

    if (!primeiraChave.value.trim()) {
        primeiraChave.classList.add('border-danger');
        campoInvalido = true;
    } else {
        primeiraChave.classList.remove('border-danger');
    }

    if (!segundaChave.value.trim()) {
        segundaChave.classList.add('border-danger');
        campoInvalido = true;
    } else {
        segundaChave.classList.remove('border-danger');
    }

    if (!campoArquivo.value.trim()) {
        campoArquivo.classList.add('border-danger');
        campoArquivoLabel.classList.add('border-danger');
        campoInvalido = true;
    } else if (campoArquivo.value.split('.').pop().toLowerCase() !== 'txt') {
        mostraMsg('erro', 'Formato de arquivo inválido!');
        campoArquivo.classList.add('border-danger');
        campoArquivoLabel.classList.add('border-danger');
        campoInvalido = true;
    } else {
        campoArquivo.classList.remove('border-danger');
        campoArquivoLabel.classList.remove('border-danger');
    }

    if (campoInvalido) return;

    arryCpfValidos = [];

    recuperaDadosTxt();
}

function mostraMsg(type, msg) {
    const elementMsg = document.getElementById('msg');
    const elementMsgText = document.getElementById('msg-text');

    if (!elementMsg || !elementMsgText) return;

    elementMsgText.innerHTML = msg;

    let itemClass = type === 'erro' ? 'alert-danger' : 'alert-success';
    let btnClass = type === 'erro' ? 'btn-outline-danger' : 'btn-outline-success';

    btnCloseMsg.classList.remove('btn-outline-danger', 'btn-outline-success');
    elementMsg.classList.remove('alert-danger', 'alert-success');

    btnCloseMsg.classList.add(btnClass);
    elementMsg.classList.add(itemClass, 'rigth-msg');
}

function fechaMsg(event) {
    event.preventDefault();
    const elementMsg = document.getElementById('msg');
    elementMsg.classList.remove('rigth-msg');
}

function setNomeCampoArquivo(event) {
    if (!campoArquivoLabel) return;

    campoArquivoLabel.innerText = event.target.files[0] ? event.target.files[0].name : '';
}

function recuperaDadosTxt() {
    loading(true);
    const file = campoArquivo.files[0];
    const fileReader = new FileReader();

    fileReader.onload = file => {
        var arrayCpf = file.target.result.split('\n');

        executaRequisicao(arrayCpf);
    };

    fileReader.onerror = () => {
        mostraMsg('erro', 'Erro ao ler dados do arquivo!');
        loading(false);
    }

    fileReader.readAsText(file);
}

async function executaRequisicao(arrayCpf) {

    await recuperaToken();

    for (let i = 0; i < arrayCpf.length; i++) {
        const cpf = arrayCpf[i];

        if (cpf && cpf.trim().length) {
            await validaCpf(cpf);
        }
    }

    if (!arryCpfValidos.length) {
        mostraMsg('erro', 'Erro ao tentar validar dados!');
        loading(false);
        return
    }

    montaTableData();
}

async function validaCpf(cpf) {

    const headers = new Headers({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    });

    const options = { method: 'GET', headers };

    const response = await fetch(`https://gateway.apiserpro.serpro.gov.br/consulta-cpf-df/v1/cpf/${cpf}`, options);

    switch (response.status) {
        case 401:
            await recuperaToken();
            await validaCpf(cpf);
            break;
        case 404:
            arryCpfValidos.push({ mensagem: `Este cpf ${cpf} não existe!` });
            break;
        case 400, 403, 500, 504:
            mostraMsg(`Erro durante a requisição, código erro: ${response.status}`);
            isLoading(false);
            break;
        default:
            const json = await response.json();
            arryCpfValidos.push(json);
            break;
    }
}

async function recuperaToken() {
    const valuePrimeiraChave = primeiraChave.value;
    const valueSegundaChave = segundaChave.value;
    const valueBase64 = btoa(`${valuePrimeiraChave}:${valueSegundaChave}`);

    const headers = new Headers({
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${valueBase64}`
    });

    const options = { method: 'POST', headers, body: 'grant_type=client_credentials' };

    const response = await fetch('https://gateway.apiserpro.serpro.gov.br/token', options);
    const json = await response.json();

    if (json.access_token) {
        token = json.access_token;
    } else {
        mostraMsg('erro', 'Erro ao recuperar Token de acesso!');
        loading(false);
        return
    }
}

function montaTableData() {
    const table = document.getElementById('table');

    if (!table) return;

    const tBody = table.getElementsByTagName('tbody')[0];

    while (tBody.children.length > 0) {
        tBody.removeChild(tBody.children[0]);
    }

    let count = 0;

    arryCpfValidos.forEach(item => {
        const dados = getDadosFormatados(item);
        const newRow = tBody.insertRow(tBody.rows.length);

        newRow.innerHTML = `<tr>
                                <td scope='row'>${dados.cpf}</td>
                                <td>${dados.nome}</td>
                                <td>${dados.situacao}</td>
                            </tr>`

        if (item.ni) count++;
    });

    if (cpfCount) {
        cpfCount.innerHTML = `Quatidade CPF validos: ${count}`
    }

    if (arryCpfValidos.length) {
        btnExportarCsv.removeAttribute('hidden');
        btnImprimir.removeAttribute('hidden');
    }

    loading(false);
}

function getDadosFormatados(item) {
    return {
        cpf: item.ni ? getCpfFormatado(item.ni) : '',
        nome: item.mensagem ? item.mensagem : item.nome,
        situacao: item.mensagem ? '' : item.situacao.descricao
    };
}

function getCpfFormatado(cpf) {
    cpf = cpf.replace(/[^\d]/g, '');
    cpf = cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    return cpf;
}

function loading(isLoading) {
    const elementLoading = document.getElementById('loading');

    if (!elementLoading) return;

    elementLoading.classList.remove('display-flex');

    const classLoading = isLoading ? 'display-flex' : 'none';

    elementLoading.classList.add(classLoading);
}

function gerarArquivoCsv() {

    if (!arryCpfValidos.length) {
        mostraMsg('erro', 'Sem dados para emitir!');
        return;
    }

    let csv = 'CPF; Nome; Situação\n';

    arryCpfValidos.forEach(item => {
        const dados = getDadosFormatados(item);
        csv += `${dados.cpf}; ${dados.nome}; ${dados.situacao} \n`;
    });

    var hiddenElement = document.createElement('a');
    hiddenElement.href = 'data:text/csv;charset=utf-8,' + encodeURI('\uFEFF' + csv);
    hiddenElement.target = '_blank';
    hiddenElement.download = 'Consumidor_UCs_Nao_Ligadas.csv';
    hiddenElement.click();
    mostraMsg('success', 'Dados exportados com sucesso!');
}

function imprimirTabela() {
    window.print();
}