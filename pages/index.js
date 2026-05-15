import { useEffect, useState } from 'react';

export default function Dashboard() {
  // Inicializa o estado com as chaves corretas combinando com a API
  const [dados, setDados] = useState({ totalGeral: 0, abertos: 0, aguardando: 0 });

  const atualizarDados = async () => {
    try {
      const res = await fetch('/api/zoho');
      const json = await res.json();
      
      // Se a API retornar um erro estrutural, evita quebrar o estado do componente
      if (json && !json.erro) {
        setDados(json);
      } else {
        console.error("Erro retornado pela API do Zoho:", json.erro);
      }
    } catch (error) {
      console.error("Erro ao buscar dados na rota local:", error);
    }
  };

  useEffect(() => {
    atualizarDados();
    const interval = setInterval(atualizarDados, 60000); // Atualiza a cada 1 minuto
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', backgroundColor: '#111', color: '#fff', height: '100vh' }}>
      <h1>Painel de Operação SAC</h1>
      <div style={{ display: 'flex', gap: '20px', marginTop: '40px' }}>
        
        {/* CORRIGIDO: mudado de dados.total para dados.totalGeral */}
        <div style={cardStyle("#333")}>
          <h2>Total de Tickets</h2>
          <p style={numberStyle}>{dados.totalGeral ?? 0}</p> 
        </div>

        <div style={cardStyle("#e74c3c")}>
          <h2>Em Aberto</h2>
          <p style={numberStyle}>{dados.abertos ?? 0}</p>
        </div>

        <div style={cardStyle("#f1c40f")}>
          <h2>Aguardando</h2>
          <p style={numberStyle}>{dados.aguardando ?? 0}</p>
        </div>

      </div>
    </div>
  );
}

const cardStyle = (color) => ({
  backgroundColor: color,
  padding: '30px',
  borderRadius: '15px',
  flex: 1,
  textAlign: 'center',
  boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
});

const numberStyle = { fontSize: '80px', fontWeight: 'bold', margin: '10px 0' };
