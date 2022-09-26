const express = require('express');
const expressHandlebars = require('express-handlebars');
const path = require('path');
const bodyParse = require('body-parser');
const sessions = require("express-session");
const cookieParser = require("cookie-parser");
const uuidv4 = require('uuid').v4;
const mysql = require('mysql2/promise');
const { chownSync } = require('fs');

const PORT = process.env.PORT || 3000;
const app = express();

app.engine('handlebars', expressHandlebars.engine());

app.set('view engine', 'handlebars');
app.set('views', './views');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(bodyParse.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

app.use(sessions({
    secret: "thisIsMySecretKey",
    saveUninitialized: true,
    resave: false,
    name: 'Cookie de Sessao',
    cookie: { maxAge: 1000 * 60 * 6 } // 6 minutos
}));

async function getConnection() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'Vilel@2002',
        database: 'financeme'
    });

    return connection;
}

async function query(sql = '', values = []) {

    const conn = await getConnection();
    const result = await conn.query(sql, values);
    conn.end();

    return result[0];
}

app.use("*", async function (req, res, next) {
    if (!req.session.usuario && req.cookies.token) {
        const resultado = ("SELECT * FROM usuarios WHERE token = ?", [req.cookies.token]);
        await query(resultado);

        if (resultado.length) {
            req.session.usuario = resultado[0];
        }
    }
    next();
});

app.get("/", async function (req, res) {
    if (!req.session.usuario) {
        res.redirect("/login");
        return;
    }

    const transacao = await query("SELECT * FROM transacao WHERE usuario_id = ?", req.session.usuario.usuario_id)
    const transacaoInfo = await query("SELECT * FROM transacaoInfo WHERE usuario_id = ?", req.session.usuario.usuario_id)
    const usuario = await query("Select * from usuarios WHERE usuario_id = ?", req.session.usuario.usuario_id);
    const julho = await query("SELECT valor,tipo FROM transacao WHERE data LIKE '%/07/%'");

    let valorJulho = 0;
    for (let i = 0; i < julho.length; i++) {
        if (julho[i].tipo == 0) {
            valorJulho = valorJulho + parseFloat(julho[i].valor);
        }
    }

    let imagem = req.session.usuario.imagem
    console.log(imagem)
    res.render('home', {
        listaTransacoes: transacao,
        listaTransacoesInfo: transacaoInfo,
        mes1: valorJulho,
        imagem: req.session.usuario.imagem
    });

});

app.post('/', async function (req, res) {

    const user = { titulo, valor, categoria, tipo, rdo } = req.body;

    let dataAtual = new Date();
    let dia = dataAtual.getDate();
    let mes = (dataAtual.getMonth() + 1);
    let ano = dataAtual.getFullYear();
    let horas = dataAtual.getHours();
    let minutos = dataAtual.getMinutes()
    let date;
    let horario;

    let novoValor, novaEntrada, novaSaida;
    let id = req.session.usuario.usuario_id;
    let dadosValidos = true;

    if (dia < 10) {
        dia = "0" + dia;

    } else if (mes < 10) {
        mes = "0" + mes;
    }
    else if (minutos < 10) {
        minutos = "0" + minutos
    } else if (horas < 10) {
        horas = "0" + horas;
    }

    date = dia + "/" + mes + "/" + ano;
    horario = horas + ":" + minutos;


    if (rdo == 1) {
        tipo = true;
    } else {
        tipo = false;
    }

    try {
        const dadosPagina = {
            tituloPagina: 'Cadastro',
            mensagem: '',
            titulo,
            valor,
            categoria,
            date,
            horario,
            tipo,
        }

        if (!titulo || !valor || !categoria) {
            throw new Error('Campo Obrigatorio Vazio!');
        }

    } catch (e) {
        dadosValidos = false;
        mensagem = e.message
        console.log(mensagem)
    }

    if (dadosValidos) {
        const valores = [id, titulo, valor, categoria, date, horario, tipo];
        const sql = "INSERT INTO transacao (usuario_id, titulo, valor, categoria, data, horario, tipo) VALUES (?,?,?,?,?,?,?)"
        await query(sql, valores);

        const dadosTransacaoInfo = await query("SELECT * FROM transacaoInfo WHERE usuario_id = ?", [req.session.usuario.usuario_id]);

        if (tipo) {
            novoValorTotal = parseFloat(dadosTransacaoInfo[0].total) + parseFloat(valor);
            novaEntrada = parseFloat(dadosTransacaoInfo[0].entradaTotal) + parseFloat(valor);
            const atualizacao = [novoValorTotal, novaEntrada, id];
            const sql2 = "UPDATE transacaoInfo SET total = ?, entradaTotal = ? WHERE usuario_id = ?";
            await query(sql2, atualizacao);
        } else {
            novoValorTotal = parseFloat(dadosTransacaoInfo[0].total) - parseFloat(valor);
            novaSaida = parseFloat(dadosTransacaoInfo[0].saidaTotal) + parseFloat(valor);
            const atualizacao = [novoValorTotal, novaSaida, id];
            const sql2 = "UPDATE transacaoInfo SET total = ?, saidaTotal = ? WHERE usuario_id = ?";
            await query(sql2, atualizacao);
        }
    }


    res.redirect('/');
});

app.get('/excluir-transacao', async function (req, res) {
    if (!req.session.usuario) {
        res.redirect("/login");
        return;
    }

    let novoValor, novaEntrada, novaSaida;

    const codigo = parseInt(req.query.codigo);
    const id = parseInt(req.session.usuario.usuario_id);

    if (!isNaN(codigo) && codigo > 0) {
        const transacao = await query("SELECT * FROM transacao WHERE codigo = ?", codigo)
        await query(`DELETE FROM transacao WHERE codigo = ?`, [codigo]);

        valor = transacao[0].valor;
        tipo = transacao[0].tipo;

        const dadosTransacaoInfo = await query("SELECT * FROM transacaoInfo WHERE usuario_id = ?", [req.session.usuario.usuario_id]);

        if (tipo == 1) {
            console.log("Positivo");

            novoValorTotal = parseFloat(dadosTransacaoInfo[0].total) - parseFloat(valor);
            novaEntrada = parseFloat(dadosTransacaoInfo[0].entradaTotal) - parseFloat(valor);

            const atualizacao = [novoValorTotal, novaEntrada, id];
            const sql3 = "UPDATE transacaoInfo SET total = ?, entradaTotal = ? WHERE usuario_id = ?";
            await query(sql3, atualizacao);

        } else {

            novoValorTotal = parseFloat(dadosTransacaoInfo[0].total) + parseFloat(valor);
            novaSaida = parseFloat(dadosTransacaoInfo[0].saidaTotal) - parseFloat(valor);

            const atualizacao = [novoValorTotal, novaSaida, id];
            const sql4 = "UPDATE transacaoInfo SET total = ?, saidaTotal = ? WHERE usuario_id = ?";
            await query(sql4, atualizacao);
        }

    }

    res.redirect('/');
})

app.get('/editar-transacao', async function (req, res) {
    const id = parseInt(req.query.codigo);
    const dadosTransacao = await query("SELECT * FROM transacao WHERE codigo = ?", [id]);

    if (dadosTransacao === 0) {
        res.redirect("/");
    }
    res.render('editar-transacao', {
        codigo: id,
        titulo: dadosTransacao[0].titulo,
        valor: dadosTransacao[0].valor,
        categoria: dadosTransacao[0].categoria,
        tipo: true
    })

});

app.post('/editar-transacao', async function (req, res) {
    let { codigo, titulo, valor, rdo, categoria } = req.body;
    console.log(codigo);
    id = req.session.usuario.usuario_id;
    let novoValor, novaEntrada, novaSaida;

    const dadosPagina = {
        mensagem: '',
        id, titulo, valor, categoria, rdo
    }

    const dadosTransacao = await query("SELECT * FROM transacao WHERE codigo = ?", codigo);

    const sql = "UPDATE transacao SET titulo = ?, valor = ?, categoria = ?, tipo = ? WHERE codigo = ?";
    const valores = [titulo, valor, categoria, rdo, codigo];
    await query(sql, valores);

    const dadosTransacaoInfo = await query("SELECT * FROM transacaoInfo WHERE usuario_id = ?", id);

    console.log(rdo != dadosTransacao[0].tipo)
    if (rdo != dadosTransacao[0].tipo) {
        if (rdo == 1) {
            1000 - 0;
            novaEntrada = parseFloat(dadosTransacaoInfo[0].entradaTotal) + parseFloat(valor);
            novaSaida = parseFloat(dadosTransacaoInfo[0].saidaTotal) - parseFloat(valor);
            novoValorTotal = novaEntrada - novaSaida;

        } else {
            novaEntrada = parseFloat(dadosTransacaoInfo[0].entradaTotal) - parseFloat(valor);
            novaSaida = parseFloat(dadosTransacaoInfo[0].saidaTotal) + parseFloat(valor);
            novoValorTotal = novaEntrada - novaSaida;
        }

        const atualizacao = [novoValorTotal, novaEntrada, novaSaida, id];
        const sql2 = "UPDATE transacaoInfo SET total = ?,entradaTotal = ?, saidaTotal = ? WHERE usuario_id = ?";
        await query(sql2, atualizacao);

    }
    res.render('editar-transacao', dadosPagina);
});

app.get("/contato", function (req, res) {
    res.render('contato');
});

app.get("/sobre", function (req, res) {
    res.render('sobre');
});

app.get("/login", function (req, res) {
    res.render("login");
});

app.post("/login", async function (req, res) {
    const user = { email, senha } = req.body;
    let dadosRender = null
    try {
        dadosRender = {
            dadosValidos: true,
            mensagem: ''
        }

        if (!email || !senha) {
            throw new Error('Campo Obrigatorio Vazio!');
        }
    } catch (e) {
        dadosRender = {
            dadosValidos: false,
            mensagem: e.message
        }

        dadosValidos = false;
        mensagem = e.message;
    }

    if (dadosRender.dadosValidos) {
        const resultado = await query("SELECT * FROM usuarios WHERE email = ? AND senha = MD5(?)", [email, senha]);
        if (resultado) {
            req.session.usuario = resultado[0];
            res.redirect("/");
        }
    } else {
        res.render("login", dadosRender);
    }

});

app.get("/logout", function (req, res) {
    res.cookie("token", "");
    req.session.destroy();
    res.redirect("/login");
});

app.get("/cadastro", function (req, res) {
    res.render('cadastro', {
        class: 'cadastro'
    });
});

app.post('/cadastro', async function (req, res) {
    const user = { nome, email, senha, senhac } = req.body;

    let dadosRender = null
    try {
        dadosRender = {
            dadosValidos: true,
            mensagem: ''
        }

        if (!nome || !email || !senha || !senhac) {
            console.log("Campo Obrigatorio Vazio");
            throw new Error('Campo Obrigatorio Vazio!');
        }

        if (senha != senhac) {
            console.log("Senhas diferentes!")
            throw new Error('Senhas diferentes!');
        }

    } catch (e) {
        dadosRender = {
            dadosValidos: false,
            mensagem: e.message
        }
    }

    if (dadosRender.dadosValidos) {
        const resultado = await query("SELECT * FROM usuarios WHERE email = ?", [email]);

        if (!(resultado == 0)) {
            dadosRender = {
                dadosValidos: false,
                mensagem: "Usuário já Cadastrado!"
            }
            res.render("Cadastro", dadosRender);
        } else {
            dadosRender = {
                dadosValidos: true,
                mensagem: "Usuário Cadastrado com sucesso!"
            }


            const valores = [nome, email, senha];

            const sql = "INSERT INTO usuarios (nome , email, senha) VALUES (?,?,MD5(?))"
            await query(sql, valores);

            const sql2 = await query("SELECT usuario_id FROM usuarios WHERE email = ?", email);

            const sql3 = "INSERT INTO transacaoInfo(usuario_id, total, saidaTotal, entradaTotal) VALUES (?, ?, ?, ?)";
            const newTransacoInfo = [sql2[0].usuario_id, 0, 0, 0];

            await query(sql3, newTransacoInfo);
            res.render("Cadastro", dadosRender);
        }
    } else {
        res.render("Cadastro", dadosRender);
    }
});

app.get("/editar-usuario", async function (req, res) {
    const id = parseInt(req.session.usuario.usuario_id);
    const dadosUsuario = await query("SELECT * FROM usuarios WHERE usuario_id = ?", [id]);

    if (dadosUsuario === 0) {
        res.redirect("/");
    }
    res.render('editar-usuario', {
        codigo: id,
        nome: dadosUsuario[0].nome,
        email: dadosUsuario[0].email,
        img: dadosUsuario[0].img
    })
});

app.post("/editar-usuario", async function (req, res) {
    let { codigo, nome, email, img } = req.body;

    const dadosUsuario = await query("SELECT * FROM usuarios WHERE usuario_id = ?", codigo);

    const sql = "UPDATE usuarios SET nome = ?, email = ?, imagem = ? WHERE usuario_id = ?";
    const valores = [nome, email, img, codigo];
    await query(sql, valores);

    res.render('editar-usuario', valores);
});

app.listen(PORT, function () {
    console.log('Server is running at port ' + PORT);
});