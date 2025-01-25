const room = new WebsimSocket();

function Browser() {
  const [currentPage, setCurrentPage] = React.useState('home');
  const [currentUrl, setCurrentUrl] = React.useState('');
  const [history, setHistory] = React.useState([]);
  
  const domains = React.useSyncExternalStore(
    room.collection('domain').subscribe,
    room.collection('domain').getList
  );

  const dnsRecords = React.useSyncExternalStore(
    room.collection('dns').subscribe,
    room.collection('dns').getList
  );

  React.useEffect(() => {
    if (history.length === 0) {
      setHistory([
        { url: 'godaddy.websim', title: 'GoDaddy' },
        { url: 'namecheap.websim', title: 'Namecheap' },
        { url: 'websim.ai', title: 'Websim' }
      ]);
    }
  }, []);

  const navigate = (url) => {
    setCurrentUrl(url);
    if (!history.find(h => h.url === url)) {
      setHistory([{ url, title: url }, ...history].slice(0, 10));
    }

    if (url === 'godaddy.websim') {
      setCurrentPage('godaddy');
    } else if (url === 'namecheap.websim') {
      setCurrentPage('namecheap');
    } else if (url === 'websim.ai') {
      setCurrentPage('websim');
    } else {
      // Check DNS records for custom routing
      const record = dnsRecords.find(r => r.domain === url);
      if (record) {
        setCurrentPage('custom');
      } else {
        setCurrentPage('404');
      }
    }
  };

  const renderContent = () => {
    switch (currentPage) {
      case 'home':
        return <History history={history} onNavigate={navigate} />;
      case 'godaddy':
        return <Registrar provider="GoDaddy" domains={domains} dnsRecords={dnsRecords} />;
      case 'namecheap':
        return <Registrar provider="Namecheap" domains={domains} dnsRecords={dnsRecords} />;
      case 'websim':
        return <iframe src="https://websim.ai" className="browser-frame" />;
      case 'custom':
        const record = dnsRecords.find(r => r.domain === currentUrl);
        return <CustomPage record={record} />;
      default:
        return <div>Page not found</div>;
    }
  };

  return (
    <div className="browser">
      <div className="address-bar">
        <input 
          type="text" 
          value={currentUrl}
          onChange={(e) => setCurrentUrl(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && navigate(currentUrl)}
        />
        <button onClick={() => navigate(currentUrl)}>Go</button>
      </div>
      <div className="content">
        {renderContent()}
      </div>
    </div>
  );
}

function History({ history, onNavigate }) {
  return (
    <div className="history">
      <h2>Recent Pages</h2>
      {history.map((item, i) => (
        <div 
          key={i} 
          className="history-item"
          onClick={() => onNavigate(item.url)}
        >
          {item.title}
        </div>
      ))}
    </div>
  );
}

function Registrar({ provider, domains, dnsRecords }) {
  const [newDomain, setNewDomain] = React.useState('');
  const [tld, setTld] = React.useState('websim');
  const [dnsEntries, setDnsEntries] = React.useState([]);

  const userDomains = domains.filter(d => d.username === room.party.client.username);

  const registerDomain = async () => {
    if (userDomains.length > 0) {
      alert('You can only register one domain');
      return;
    }

    const fullDomain = `${newDomain}.${tld}`;
    if (domains.find(d => d.domain === fullDomain)) {
      alert('Domain already registered');
      return;
    }

    await room.collection('domain').create({
      domain: fullDomain,
      provider
    });

    setNewDomain('');
  };

  const addDnsRecord = async (domain) => {
    await room.collection('dns').create({
      domain,
      ip: room.party.client.username,
      type: 'A'
    });
  };

  return (
    <div className="registrar">
      <h2>{provider} Domain Registration</h2>
      
      <div className="domain-form">
        <input
          type="text"
          value={newDomain}
          onChange={(e) => setNewDomain(e.target.value)}
          placeholder="Enter domain name"
        />
        <select value={tld} onChange={(e) => setTld(e.target.value)}>
          <option value="websim">websim</option>
          <option value="com">com</option>
          <option value="org">org</option>
          <option value="net">net</option>
        </select>
        <button onClick={registerDomain}>Register</button>
      </div>

      <h3>Your Domains</h3>
      {userDomains.map(domain => (
        <div key={domain.id}>
          <p>{domain.domain}</p>
          <div className="dns-records">
            <h4>DNS Records</h4>
            {dnsRecords
              .filter(r => r.domain === domain.domain)
              .map(record => (
                <div key={record.id} className="dns-record">
                  <span>Type: {record.type}</span>
                  <span>IP: {record.ip}</span>
                </div>
              ))}
            <button onClick={() => addDnsRecord(domain.domain)}>
              Add DNS Record
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function CustomPage({ record }) {
  return (
    <div>
      <h2>Custom Page</h2>
      <p>Hosted by: {record.ip}</p>
    </div>
  );
}

ReactDOM.render(<Browser />, document.getElementById('root'));