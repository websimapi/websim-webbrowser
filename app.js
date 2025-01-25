const room = new WebsimSocket();

function Browser() {
  const [currentPage, setCurrentPage] = React.useState('home');
  const [currentUrl, setCurrentUrl] = React.useState('');
  const [history, setHistory] = React.useState([]);
  
  const peers = React.useSyncExternalStore(
    room.party.subscribe,
    () => room.party.peers
  );

  const domains = React.useSyncExternalStore(
    room.collection('domain').subscribe,
    room.collection('domain').getList
  );

  const dnsRecords = React.useSyncExternalStore(
    room.collection('dns').subscribe,
    room.collection('dns').getList
  );

  const hostedCode = React.useSyncExternalStore(
    room.collection('hosted_code').subscribe,
    room.collection('hosted_code').getList
  );

  React.useEffect(() => {
    if (history.length === 0) {
      setHistory([
        { url: 'godaddy.websim', title: 'GoDaddy' },
        { url: 'namecheap.websim', title: 'Namecheap' },
        { url: 'websim.ai', title: 'Websim' },
        { url: 'hosting.websim', title: 'Code Hosting' }
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
    } else if (url === 'hosting.websim') {
      setCurrentPage('hosting');
    } else {
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
        return <Registrar provider="GoDaddy" domains={domains} dnsRecords={dnsRecords} peers={peers} />;
      case 'namecheap':
        return <Registrar provider="Namecheap" domains={domains} dnsRecords={dnsRecords} peers={peers} />;
      case 'websim':
        return <iframe src="https://websim.ai" className="browser-frame" />;
      case 'hosting':
        return <HostingPage hostedCode={hostedCode} />;
      case 'custom':
        const record = dnsRecords.find(r => r.domain === currentUrl);
        const code = hostedCode.find(c => c.username === record.ip);
        return <CustomPage record={record} code={code} />;
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

function Registrar({ provider, domains, dnsRecords, peers }) {
  const [newDomain, setNewDomain] = React.useState('');
  const [tld, setTld] = React.useState('websim');
  const [selectedUser, setSelectedUser] = React.useState('');
  const [dnsType, setDnsType] = React.useState('A');

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
    if (!selectedUser) {
      alert('Please select a user to point the domain to');
      return;
    }

    // Check if DNS record already exists for this domain
    if (dnsRecords.find(r => r.domain === domain)) {
      const confirm = window.confirm('DNS record already exists. Do you want to update it?');
      if (!confirm) return;
      
      // Delete existing record
      const existingRecord = dnsRecords.find(r => r.domain === domain);
      await room.collection('dns').delete(existingRecord.id);
    }

    await room.collection('dns').create({
      domain,
      ip: selectedUser,
      type: dnsType
    });
    
    setSelectedUser('');
    setDnsType('A');
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

      <h3>DNS Management</h3>
      <div className="dns-management">
        <div className="dns-controls">
          <select 
            value={dnsType} 
            onChange={(e) => setDnsType(e.target.value)}
            className="dns-type-select"
          >
            <option value="A">A Record</option>
            <option value="CNAME">CNAME Record</option>
            <option value="MX">MX Record</option>
            <option value="TXT">TXT Record</option>
          </select>
          
          <select 
            value={selectedUser} 
            onChange={(e) => setSelectedUser(e.target.value)}
            className="user-select"
          >
            <option value="">Select User IP</option>
            {Object.entries(peers).map(([id, peer]) => (
              <option key={id} value={peer.username}>
                {peer.username}
              </option>
            ))}
          </select>
        </div>

        <div className="user-list">
          <h4>Connected Users</h4>
          {Object.entries(peers).map(([id, peer]) => (
            <div key={id} className="user-ip">
              <img 
                src={`https://images.websim.ai/avatar/${peer.username}`} 
                alt={peer.username} 
                className="user-avatar" 
              />
              <span>{peer.username}</span>
              <button 
                onClick={() => setSelectedUser(peer.username)}
                className={selectedUser === peer.username ? 'selected' : ''}
              >
                Select
              </button>
            </div>
          ))}
        </div>
      </div>

      <h3>Your Domains</h3>
      {userDomains.map(domain => (
        <div key={domain.id} className="domain-record">
          <p className="domain-name">{domain.domain}</p>
          <div className="dns-records">
            <h4>DNS Records</h4>
            {dnsRecords
              .filter(r => r.domain === domain.domain)
              .map(record => (
                <div key={record.id} className="dns-record">
                  <span className="record-type">Type: {record.type}</span>
                  <span className="record-ip">Points to: {record.ip}</span>
                  <button 
                    onClick={() => room.collection('dns').delete(record.id)}
                    className="delete-record"
                  >
                    Delete
                  </button>
                </div>
              ))}
            <button 
              onClick={() => addDnsRecord(domain.domain)}
              disabled={!selectedUser}
              className="add-dns-record"
            >
              Add DNS Record {selectedUser ? `-> ${selectedUser}` : ''}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function HostingPage({ hostedCode }) {
  const [html, setHtml] = React.useState('');
  const [css, setCss] = React.useState('');
  const [js, setJs] = React.useState('');

  const userCode = hostedCode.find(c => c.username === room.party.client.username);

  React.useEffect(() => {
    if (userCode) {
      setHtml(userCode.html);
      setCss(userCode.css);
      setJs(userCode.js);
    }
  }, [userCode]);

  const saveCode = async () => {
    if (userCode) {
      await room.collection('hosted_code').update(userCode.id, {
        html, css, js
      });
    } else {
      await room.collection('hosted_code').create({
        html, css, js
      });
    }
  };

  return (
    <div className="hosting-page">
      <h2>Code Hosting</h2>
      <div className="code-editor">
        <div className="editor-column">
          <h3>HTML</h3>
          <textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            placeholder="Enter HTML code"
          />
        </div>
        <div className="editor-column">
          <h3>CSS</h3>
          <textarea
            value={css}
            onChange={(e) => setCss(e.target.value)}
            placeholder="Enter CSS code"
          />
        </div>
        <div className="editor-column">
          <h3>JavaScript</h3>
          <textarea
            value={js}
            onChange={(e) => setJs(e.target.value)}
            placeholder="Enter JavaScript code"
          />
        </div>
      </div>
      <button onClick={saveCode}>Save Code</button>
      
      <div className="preview">
        <h3>Preview</h3>
        <iframe
          srcDoc={`
            <html>
              <style>${css}</style>
              <body>${html}</body>
              <script>${js}</script>
            </html>
          `}
          style={{ width: '100%', height: '300px', border: 'none' }}
        />
      </div>
    </div>
  );
}

function CustomPage({ record, code }) {
  if (!code) return <div>No hosted content found</div>;

  return (
    <iframe
      srcDoc={`
        <html>
          <style>${code.css}</style>
          <body>${code.html}</body>
          <script>${code.js}</script>
        </html>
      `}
      style={{ width: '100%', height: '100%', border: 'none' }}
    />
  );
}

ReactDOM.render(<Browser />, document.getElementById('root'));