create database financeme;
use financeme;

create table usuarios (
	usuario_id int auto_increment,
	nome varchar(50) NOT NULL,
	email varchar(50) NOT NULL,
	senha varchar(100) NOT NULL,
	primary key (usuario_id)
);

CREATE TABLE transacao(
	codigo SMALLINT PRIMARY KEY AUTO_INCREMENT, 
	usuario_id int, 
	titulo varchar(50), 
	valor float,
	categoria varchar(50), 
	data varchar(10),
	horario varchar(5), 
	tipo boolean, 
	FOREIGN KEY(usuario_id) REFERENCES usuarios(usuario_id)
 ) AUTO_INCREMENT = 0;

CREATE TABLE transacaoInfo(
	usuario_id int,
	total float,
    saidaTotal float, 
    entradaTotal float, 
    FOREIGN KEY(usuario_id) REFERENCES usuarios(usuario_id)
);


