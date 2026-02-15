const http = require('http');
const url = require('url');
const querystring = require('querystring');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const FileUploader =  require('./file.js')


class NanoExpress {
  constructor() {
    this.routes = {
      GET: [],
      POST: [],
      PUT: [],
      DELETE: [],
      PATCH: []
    };
    this.middlewares = [];
    this.staticPath = null;
    this.viewsPath = './views';
  }


  use(middleware) {
    this.middlewares.push(middleware);
  }


  get(path, handler) {
    this.routes.GET.push({ path, handler, pattern: this._createPattern(path) });
  }

  post(path, handler) {
    this.routes.POST.push({ path, handler, pattern: this._createPattern(path) });
  }

  put(path, handler) {
    this.routes.PUT.push({ path, handler, pattern: this._createPattern(path) });
  }

  delete(path, handler) {
    this.routes.DELETE.push({ path, handler, pattern: this._createPattern(path) });
  }

  patch(path, handler) {
    this.routes.PATCH.push({ path, handler, pattern: this._createPattern(path) });
  }

 
  static(folderPath) {
    this.staticPath = folderPath;
    this.use((req, res, next) => {
      if (req.method === 'GET' && !req.handled) {
        const filePath = path.join(folderPath, req.pathname);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(filePath);
          const contentType = this._getContentType(ext);
          res.setHeader('Content-Type', contentType);
          res.end(fs.readFileSync(filePath));
          req.handled = true;
          return;
        }
      }
      next();
    });
  }


  setViews(path) {
    this.viewsPath = path;
  }

   
  DisplayFiles(routePath, folderPath, allowedExtensions = null) {
    const self = this;
 
    const resolvedFolder = path.resolve(folderPath);
    const allowedExts = allowedExtensions 
      ? allowedExtensions.split(',').map(ext => ext.trim().toLowerCase())
      : null;

    this.get(routePath, function(req, res) {
      try {
        const requestedPath = req.query.path || '';
        const fullPath = path.join(resolvedFolder, requestedPath);
        
     
        if (!fullPath.startsWith(resolvedFolder)) {
          return res.status(403).send('Access denied');
        }

        if (!fs.existsSync(fullPath)) {
          return res.status(404).send('Not found');
        }

        const stat = fs.statSync(fullPath);
        
       
        if (stat.isFile()) {
          const ext = path.extname(fullPath).toLowerCase();
          if (allowedExts && !allowedExts.includes(ext)) {
            return res.status(403).send('File type not allowed');
          }
          
          res.setHeader('Content-Disposition', `attachment; filename="${path.basename(fullPath)}"`);
          res.setHeader('Content-Type', 'application/octet-stream');
          return res.end(fs.readFileSync(fullPath));
        }

   
        const files = fs.readdirSync(fullPath);
        const currentUrl = req.pathname;
        
     
        let html = `<!DOCTYPE html>
<html>
<head>
    <title>Index of ${requestedPath || '/'}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', system-ui, sans-serif; background: #f7fafc; padding: 40px 20px; color: #2d3748; }
        .container { max-width: 1000px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.07); overflow: hidden; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px 30px; }
        .header h1 { font-size: 1.5rem; font-weight: 600; }
        .breadcrumb { background: #edf2f7; padding: 15px 30px; border-bottom: 1px solid #e2e8f0; }
        .breadcrumb a { color: #667eea; text-decoration: none; margin-right: 10px; }
        .breadcrumb a:hover { text-decoration: underline; }
        .file-list { padding: 20px 30px; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 12px; border-bottom: 2px solid #e2e8f0; color: #718096; font-weight: 600; font-size: 0.875rem; text-transform: uppercase; }
        td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
        tr:hover td { background: #f7fafc; }
        .icon { width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; margin-right: 10px; border-radius: 4px; font-size: 0.875rem; }
        .folder-icon { background: #feebc8; color: #744210; }
        .file-icon { background: #e2e8f0; color: #4a5568; }
        .pdf-icon { background: #fed7d7; color: #742a2a; }
        .img-icon { background: #c6f6d5; color: #22543d; }
        .js-icon { background: #fefcbf; color: #744210; }
        .html-icon { background: #bee3f8; color: #2a4365; }
        .css-icon { background: #c3dafe; color: #3730a3; }
        a.file-link { color: #2d3748; text-decoration: none; display: flex; align-items: center; }
        a.file-link:hover { color: #667eea; }
        .size { color: #718096; font-size: 0.875rem; }
        .date { color: #718096; font-size: 0.875rem; }
        .empty { text-align: center; padding: 60px 20px; color: #718096; }
        .back-link { display: inline-flex; align-items: center; margin-bottom: 20px; color: #667eea; text-decoration: none; font-weight: 500; }
        .back-link:hover { text-decoration: underline; }
        .filter-info { background: #edf2f7; padding: 10px 15px; border-radius: 6px; margin-bottom: 20px; font-size: 0.875rem; color: #4a5568; }
        .filter-info strong { color: #2d3748; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📁 Index of ${requestedPath || '/'}</h1>
        </div>
        <div class="breadcrumb">`;

    
        const pathParts = requestedPath.split('/').filter(Boolean);
        let breadcrumbPath = '';
        html += `<a href="${currentUrl}">🏠 Home</a>`;
        for (const part of pathParts) {
          breadcrumbPath += '/' + part;
          html += ` / <a href="${currentUrl}?path=${encodeURIComponent(breadcrumbPath)}">${part}</a>`;
        }
        
        html += `</div><div class="file-list">`;

     
        if (allowedExts) {
          html += `<div class="filter-info"> <strong>Filtered view:</strong> Only showing files with extensions: ${allowedExts.join(', ')}</div>`;
        }

     
        if (requestedPath) {
          const parentPath = path.dirname(requestedPath);
          const parentUrl = parentPath === '.' ? currentUrl : `${currentUrl}?path=${encodeURIComponent(parentPath)}`;
          html += `<a href="${parentUrl}" class="back-link">← Back to parent directory</a>`;
        }

        html += `<table>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Size</th>
                    <th>Modified</th>
                </tr>
            </thead>
            <tbody>`;

        if (files.length === 0) {
          html += `<tr><td colspan="3" class="empty">📂 This directory is empty</td></tr>`;
        } else {
       
          const folders = [];
          const fileList = [];

          for (const file of files) {
            const filePath = path.join(fullPath, file);
            const fileStat = fs.statSync(filePath);
            const ext = path.extname(file).toLowerCase();

        
            if (!fileStat.isDirectory() && allowedExts && !allowedExts.includes(ext)) {
              continue;
            }

            if (fileStat.isDirectory()) {
              folders.push({ name: file, stat: fileStat });
            } else {
              fileList.push({ name: file, stat: fileStat, ext });
            }
          }

       
          folders.sort((a, b) => a.name.localeCompare(b.name));
          fileList.sort((a, b) => a.name.localeCompare(b.name));

      
          for (const folder of folders) {
            const folderUrl = `${currentUrl}?path=${encodeURIComponent(path.join(requestedPath, folder.name))}`;
            html += `<tr>
                <td>
                    <a href="${folderUrl}" class="file-link">
                        <span class="icon folder-icon">📁</span>
                        ${folder.name}/
                    </a>
                </td>
                <td class="size">-</td>
                <td class="date">${folder.stat.mtime.toLocaleString()}</td>
            </tr>`;
          }

      
          for (const file of fileList) {
            const fileUrl = `${currentUrl}?path=${encodeURIComponent(path.join(requestedPath, file.name))}`;
            const size = self._formatFileSize(file.stat.size);
            
            
            let iconClass = 'file-icon';
            let icon = '📄';
            switch (file.ext) {
              case '.pdf': iconClass = 'pdf-icon'; icon = '📕'; break;
              case '.jpg':
              case '.jpeg':
              case '.png':
              case '.gif':
              case '.svg': iconClass = 'img-icon'; icon = '🖼️'; break;
              case '.js': iconClass = 'js-icon'; icon = '📜'; break;
              case '.html':
              case '.htm': iconClass = 'html-icon'; icon = '🌐'; break;
              case '.css': iconClass = 'css-icon'; icon = '🎨'; break;
              case '.json': icon = '📋'; break;
              case '.zip':
              case '.rar': icon = '📦'; break;
              case '.txt': icon = '📝'; break;
            }

            html += `<tr>
                <td>
                    <a href="${fileUrl}" class="file-link" download>
                        <span class="icon ${iconClass}">${icon}</span>
                        ${file.name}
                    </a>
                </td>
                <td class="size">${size}</td>
                <td class="date">${file.stat.mtime.toLocaleString()}</td>
            </tr>`;
          }
        }

        html += `</tbody></table>
        </div>
    </div>
</body>
</html>`;

        res.setHeader('Content-Type', 'text/html');
        res.end(html);
        
      } catch (err) {
        console.error('ERROR in DisplayFiles handler:', err);
        res.status(500).send('Error: ' + err.message);
      }
    });
  }
  
  
  
  _formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /*_createPattern(routePath) {
    const paramNames = [];
    const regexPattern = routePath.replace(/:([^/]+)/g, (match, paramName) => {
      paramNames.push(paramName);
      return '([^/]+)';
    });
    return {
      regex: new RegExp(`^${regexPattern}$`),
      paramNames
    };
  }


  _matchRoute(routes, pathname) {
    for (const route of routes) {
      const match = pathname.match(route.pattern.regex);
      if (match) {
        const params = {};
        route.pattern.paramNames.forEach((name, index) => {
          params[name] = match[index + 1];
        });
        return { ...route, params };
      }
    }
    return null;
  }
*/


  _createPattern(routePath) {

    if (!routePath.includes(':')) {
      return {
        regex: new RegExp(`^${routePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
        paramNames: []
      };
    }
    
    const paramNames = [];
    const regexPattern = routePath.replace(/:([^/]+)/g, (match, paramName) => {
      paramNames.push(paramName);
      return '([^/]+)';
    });
    return {
      regex: new RegExp(`^${regexPattern}$`),
      paramNames
    };
  }
  
  
    _matchRoute(routes, pathname) {
    console.log('========================================');
    console.log('Original pathname:', JSON.stringify(pathname));
    console.log('Pathname length:', pathname.length);
    console.log('Char codes:', [...pathname].map(c => c.charCodeAt(0)));
    

    const normalizedPath = pathname !== '/' ? pathname.replace(/\/$/, '') : pathname;
    console.log('Normalized pathname:', JSON.stringify(normalizedPath));
    console.log('Normalized length:', normalizedPath.length);
    console.log('Normalized char codes:', [...normalizedPath].map(c => c.charCodeAt(0)));
    
    for (const route of routes) {
      console.log('----------------------------------------');
      console.log('Testing route:', JSON.stringify(route.path));
      
     
      const normalizedRoute = route.path !== '/' ? route.path.replace(/\/$/, '') : route.path;
      console.log('Normalized route:', JSON.stringify(normalizedRoute));
      console.log('Route length:', normalizedRoute.length);
      console.log('Route char codes:', [...normalizedRoute].map(c => c.charCodeAt(0)));
      
    
      console.log('String comparison:', normalizedPath === normalizedRoute);
      console.log('Includes check:', normalizedPath.includes(normalizedRoute));
      
     
      let regexPattern;
      if (!normalizedRoute.includes(':')) {
        regexPattern = `^${normalizedRoute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`;
      } else {
        regexPattern = '^' + normalizedRoute.replace(/:([^/]+)/g, '([^/]+)') + '$';
      }
      
      console.log('Regex pattern:', regexPattern);
      
      const regex = new RegExp(regexPattern);
      console.log('Regex object:', regex);
      
      const match = normalizedPath.match(regex);
      console.log('Match result:', match);
      
      if (match) {
        console.log('>>> MATCH FOUND! <<<');
        const params = {};
        const paramNames = [];
        if (normalizedRoute.includes(':')) {
          const paramMatches = normalizedRoute.match(/:([^/]+)/g);
          if (paramMatches) {
            paramMatches.forEach((p, i) => {
              paramNames.push(p.substring(1));
            });
          }
        }
        paramNames.forEach((name, index) => {
          params[name] = match[index + 1];
        });
        return { ...route, params };
      }
    }
    console.log('========================================');
    console.log('NO MATCH FOUND');
    return null;
  }
  
    /*_matchRoute(routes, pathname) {
    console.log('Trying to match:', pathname);
    console.log('Available routes:', routes.map(r => ({ path: r.path, regex: r.pattern.regex.toString() })));
    
    for (const route of routes) {
      const match = pathname.match(route.pattern.regex);
      console.log('Testing route:', route.path, 'regex:', route.pattern.regex, 'match:', match);
      if (match) {
        const params = {};
        route.pattern.paramNames.forEach((name, index) => {
          params[name] = match[index + 1];
        });
        return { ...route, params };
      }
    }
    return null;
  }*/
 
  _getContentType(ext) {
    const types = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon'
    };
    return types[ext] || 'application/octet-stream';
  }

 
  listen(port, callback) {
    const server = http.createServer((req, res) => {
   
      const parsedUrl = url.parse(req.url, true);
      req.pathname = parsedUrl.pathname;
      req.query = parsedUrl.query;
      
      
      console.log('Incoming request:', req.method, req.url);
      console.log('Parsed pathname:', JSON.stringify(req.pathname));
      console.log('Parsed query:', req.query);
      
     
      this._enhanceResponse(req, res);
      
     
      this._enhanceRequest(req, res);

    
      let index = 0;
      const next = () => {
        if (index < this.middlewares.length) {
          const middleware = this.middlewares[index++];
          middleware(req, res, next);
        } else {
          this._handleRoute(req, res);
        }
      };
      next();
    });
    
    
    

    server.listen(port, callback);
    return server;
  }

  
  _enhanceRequest(req, res) {
    req.body = {};
    req.files = {};
    
   
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        const contentType = req.headers['content-type'] || '';
        
        if (contentType.includes('application/json')) {
          try {
            req.body = JSON.parse(body);
          } catch (e) {
            req.body = {};
          }
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
          req.body = querystring.parse(body);
        } else if (contentType.includes('multipart/form-data')) {
          this._parseMultipart(req, body, contentType);
        }
      });
    }
  }

 
  _parseMultipart(req, body, contentType) {
    const boundary = contentType.split('boundary=')[1];
    if (!boundary) return;

    const parts = body.split(`--${boundary}`);
    parts.forEach(part => {
      if (part.includes('Content-Disposition')) {
        const nameMatch = part.match(/name="([^"]+)"/);
        const filenameMatch = part.match(/filename="([^"]+)"/);
        
        if (nameMatch) {
          const name = nameMatch[1];
          const contentStart = part.indexOf('\r\n\r\n') + 4;
          const content = part.substring(contentStart, part.lastIndexOf('\r\n'));
          
          if (filenameMatch) {
            req.files[name] = {
              filename: filenameMatch[1],
              content: Buffer.from(content, 'binary'),
              mimetype: part.match(/Content-Type: ([^\r\n]+)/)?.[1] || 'application/octet-stream'
            };
          } else {
            req.body[name] = content;
          }
        }
      }
    });
  }


  _enhanceResponse(req, res) {
  
    res.json = (data) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
    };

 
    res.send = (data) => {
      if (typeof data === 'object') {
        res.json(data);
      } else {
        res.end(String(data));
      }
    };

   
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };

   
    res.redirect = (location) => {
      res.statusCode = 302;
      res.setHeader('Location', location);
      res.end();
    };

  
    res.render = (viewName, data = {}) => {
      const viewPath = path.join(this.viewsPath, `${viewName}.html`);
      if (fs.existsSync(viewPath)) {
        const template = fs.readFileSync(viewPath, 'utf8');
        const rendered = this._renderTemplate(template, data);
        res.setHeader('Content-Type', 'text/html');
        res.end(rendered);
      } else {
        res.status(404).send(`View ${viewName} not found`);
      }
    };

    
    res.setCookie = (name, value, options = {}) => {
      const defaults = {
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        path: '/'
      };
      const opts = { ...defaults, ...options };
      
      let cookie = `${name}=${encodeURIComponent(value)}`;
      if (opts.maxAge) cookie += `; Max-Age=${Math.floor(opts.maxAge / 1000)}`;
      if (opts.httpOnly) cookie += '; HttpOnly';
      if (opts.secure) cookie += '; Secure';
      if (opts.path) cookie += `; Path=${opts.path}`;
      if (opts.sameSite) cookie += `; SameSite=${opts.sameSite}`;
      
      const existing = res.getHeader('Set-Cookie') || [];
      const cookies = Array.isArray(existing) ? existing : [existing];
      cookies.push(cookie);
      res.setHeader('Set-Cookie', cookies);
    };

    
    res.removeCookie = (name) => {
      res.setCookie(name, '', { maxAge: 0 });
    };

    
    res.setSession = (name, value, secret = 'default-secret') => {
      const data = JSON.stringify(value);
      const signature = crypto.createHmac('sha256', secret).update(data).digest('hex');
      const sessionData = Buffer.from(`${data}.${signature}`).toString('base64');
      res.setCookie(`session_${name}`, sessionData, { httpOnly: true });
    };

    
    res.clearSession = (name) => {
      res.removeCookie(`session_${name}`);
    };
  }


  _renderTemplate(template, data) {

    /*const getValue = (obj, path) => {
      return path.split('.').reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : '';
      }, obj);
    };*/
    
     const getValue = (obj, path) => {
      const parts = path.split(/\.|\[(\d+)\]/).filter(Boolean);
      return parts.reduce((current, key) => {
        if (current === undefined || current === null) return '';
        if (/^\d+$/.test(key)) {
          return current[parseInt(key)];
        }
        return current[key];
      }, obj);
    };

  
   /* template = template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, path) => {
      const value = getValue(data, path);
      return value !== undefined ? String(value) : '';
    });
    */
    template = template.replace(/\{\{\s*([\w.\[\]]+)\s*\}\}/g, (match, path) => {
      const value = getValue(data, path);
      return value !== undefined ? String(value) : '';
    });


    //template = this._processIfBlocks(template, data, getValue);
	 template = this._processIfBlocks(template, data, getValue);
 
   
   
   /* template = template.replace(/<\?\s*foreach\s*\(\s*\$(\w+)\s+as\s+\$(\w+)\s*\):\s*\?>([\s\S]*?)<\?\s*endforeach;\s*\?>/g, (match, arrName, itemName, content) => {
      const arr = data[arrName] || [];
      return arr.map(item => {
        const itemData = { ...data, [itemName]: item };
        return this._renderTemplate(content, itemData);
      }).join('');
    });
    */
    
     template = template.replace(/<\?\s*foreach\s*\(\s*\$(\w+)\s+as\s+\$(\w+)\s*\):\s*\?>([\s\S]*?)<\?\s*endforeach;\s*\?>/g, (match, arrName, itemName, content) => {
      const arr = data[arrName] || [];
      return arr.map(item => {
        const itemData = { ...data, [itemName]: item };
        return this._renderTemplate(content, itemData);
      }).join('');
    });


   
    template = template.replace(/<\?\s*include\s+['"]([^'"]+)['"]\s*\?>/g, (match, includePath) => {
      const fullPath = path.join(this.viewsPath, includePath);
      if (fs.existsSync(fullPath)) {
        const includeContent = fs.readFileSync(fullPath, 'utf8');
        return this._renderTemplate(includeContent, data);
      }
      return '';
    });
    
    
    
    

    return template;
  }

 
  _processIfBlocks(template, data, getValue) {

    const ifRegex = /<\?\s*if\s*\(\s*\$?([\w.]+)\s*\):\s*\?>([\s\S]*?)(?:<\?\s*elseif\s*\(\s*\$?([\w.]+)\s*\):\s*\?>([\s\S]*?))*(?:<\?\s*else\s*:\s*\?>([\s\S]*?))?<\?\s*endif;\s*\?>/g;
    
    return template.replace(ifRegex, (match, ...args) => {

      let index = 0;
      const firstCondition = args[index++];
      const firstContent = args[index++];
      
    
      if (getValue(data, firstCondition)) {
        return firstContent;
      }
      
      
      while (index < args.length - 2) { 
        const elseifCondition = args[index++];
        const elseifContent = args[index++];
        
        if (elseifCondition && getValue(data, elseifCondition)) {
          return elseifContent;
        }
      }
      
      const elseContent = args[args.length - 3];
      return elseContent || '';
    });
  }

 
/*  _handleRoute(req, res) {
    const routes = this.routes[req.method];
    if (!routes) {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const matchedRoute = this._matchRoute(routes, req.pathname);
    if (matchedRoute) {
      req.params = matchedRoute.params;
      matchedRoute.handler(req, res);
    } else {
      res.status(404).send('Not Found');
    }
  }
  
  */
  
  
  
    _handleRoute(req, res) {
    const routes = this.routes[req.method];
    if (!routes) {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const matchedRoute = this._matchRoute(routes, req.pathname);
    if (matchedRoute) {
      console.log('Route matched! Calling handler for:', matchedRoute.path);
      req.params = matchedRoute.params;
      try {
        matchedRoute.handler(req, res);
      } catch (err) {
        console.error('Handler error:', err);
        res.status(500).send('Internal error');
      }
    } else {
      console.log('No route matched for:', req.pathname);
      res.status(404).send('Not Found');
    }
  }
  
  
  
}


const app = new NanoExpress();
const uploader = new FileUploader('./uploads');


app.static('./public');

app.DisplayFiles('/files', './public');    
console.log('Registered GET routes:', app.routes.GET.map(r => r.path));



app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});


app.setViews('./views');

app.get('/test', (req, res) => {
  res.json({ message: 'Test works', query: req.query });
});

app.get('/search', (req, res) => {
  res.json({ message: 'Test works', query: req.query });
});

app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`
    <h1>NanoExpress Framework</h1>
    <p>Welcome to the lightweight Express-like framework!</p>
    <ul>
      <li><a href="/user/123">Route Params Example</a></li>
      <li><a href="/search?q=nodejs">Query Params Example</a></li>
      <li><a href="/form">Form with File Upload</a></li>
      <li><a href="/set-cookie">Set Cookie Example</a></li>
      <li><a href="/session-demo">Session Demo</a></li>
      <li><a href="/mvc-demo">MVC Render Demo</a></li>
      <li><a href="/profile/John">Profile Page Demo</a></li>
      <li><a href="/status/pending">Status: Pending</a></li>
      <li><a href="/status/active">Status: Active</a></li>
      <li><a href="/status/banned">Status: Banned</a></li>
    </ul>
  `);
});


app.get('/user/:id', (req, res) => {

  res.json({
    message: 'User details',
    userId: req.params.id,
    query: req.query
  });
});


app.get('/api/users', (req, res) => {
  res.json([
    { id: 1, name: 'John Doe' },
    { id: 2, name: 'Jane Smith' }
  ]);
});


app.post('/api/users', (req, res) => {
  res.json({
    message: 'User created',
    data: req.body
  });
});


app.get('/set-cookie', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.setCookie('username', 'JohnDoe', { maxAge: 900000 });
  res.setCookie('preferences', JSON.stringify({ theme: 'dark' }));
  res.send('Cookies set! <a href="/get-cookie">Check cookies</a>');
});

app.get('/get-cookie', (req, res) => {
  const cookies = req.headers.cookie || 'No cookies';
  res.setHeader('Content-Type', 'text/html');
  res.send(`Cookies: ${cookies} <br><a href="/remove-cookie">Remove cookie</a>`);
});

app.get('/remove-cookie', (req, res) => {
  res.removeCookie('username');
  res.setHeader('Content-Type', 'text/html');
  res.send('Cookie removed! <a href="/">Home</a>');
});


app.get('/session-demo', (req, res) => {
res.setHeader('Content-Type', 'text/html');
  res.setSession('user', { 
    id: 1, 
    name: 'John Doe', 
    loginTime: new Date().toISOString() 
  });
  res.send('Session set! <a href="/check-session">Check session</a>');
});

app.get('/check-session', (req, res) => {
res.setHeader('Content-Type', 'text/html');
  res.send('Check your browser cookies for session data');
});


app.get('/form', (req, res) => {
res.setHeader('Content-Type', 'text/html');
  res.send(`
    <form action="/upload" method="POST" enctype="multipart/form-data">
      <h2>File Upload Demo</h2>
      <input type="text" name="title" placeholder="Title" required><br><br>
      <input type="file" name="document" required><br><br>
      <button type="submit">Upload</button>
    </form>
  `);
});

app.post('/upload', async (req, res) => {
  try {
    const fileInfo = await uploader.saveFile('document', req);
    res.json({
      message: 'File uploaded successfully',
      file: fileInfo,
      formData: req.body
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});


app.get('/mvc-demo', (req, res) => {
  res.render('home', {
    title: 'Welcome to NanoExpress MVC',
    siteName: 'NanoExpress',
    user: {
      name: 'Administrator',
      email: 'admin@nanoexpress.com',
      role: 'Super Admin'
    },
    users: [
      { name: 'Alice', age: 25, email: 'alice@example.com' },
      { name: 'Bob', age: 30, email: 'bob@example.com' },
      { name: 'Charlie', age: 35, email: 'charlie@example.com' }
    ],
    showList: true,
    stats: {
      totalUsers: 150,
      activeUsers: 89
    }
  });
});

app.get('/profile/:name', (req, res) => {
  res.render('profile', {
    user: {
      name: req.params.name,
      email: `${req.params.name.toLowerCase()}@example.com`,
      bio: 'Full-stack developer passionate about Node.js',
      joined: '2024-01-15',
      location: 'San Francisco, CA',
      website: 'https://github.com/' + req.params.name.toLowerCase()
    },
    skills: ['JavaScript', 'Node.js', 'React', 'MongoDB', 'Docker'],
    isOnline: true
  });
});


app.get('/status/:state', (req, res) => {
  const state = req.params.state;
  res.render('status', {
    userStatus: state, 
    userName: 'JohnDoe',
    isLoggedIn: true,
    role: state === 'active' ? 'member' : 'guest',
    postCount: state === 'active' ? 42 : 0,
    warningLevel: state === 'banned' ? 'high' : 'low'
  });
});


const PORT = 3000;
app.listen(PORT, () => {
  console.log(` Express server running on http://localhost:${PORT}`);
});


const viewsDir = './views';
if (!fs.existsSync(viewsDir)) {
  fs.mkdirSync(viewsDir, { recursive: true });
}


const headerTemplate = `<header style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1rem 2rem; margin-bottom: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <div style="max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center;">
        <h1 style="margin: 0; font-size: 1.5rem;">{{ siteName }}</h1>
        <nav>
            <a href="/" style="color: white; margin-right: 20px; text-decoration: none; font-weight: 500;">Home</a>
            <a href="/mvc-demo" style="color: white; margin-right: 20px; text-decoration: none; font-weight: 500;">Dashboard</a>
            <a href="/form" style="color: white; text-decoration: none; font-weight: 500;">Upload</a>
        </nav>
    </div>
</header>`;


const footerTemplate = `<footer style="margin-top: 40px; padding: 30px; background: #2d3748; color: #cbd5e0; text-align: center;">
    <p>&copy; 2024 {{ siteName }}. All rights reserved.</p>
    <p style="font-size: 0.9rem; margin-top: 10px;">Built with NanoExpress Framework</p>
</footer>`;


const homeTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ title }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', system-ui, sans-serif; background: #f7fafc; line-height: 1.6; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .welcome-card { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.07); margin-bottom: 30px; }
        .user-info { display: flex; align-items: center; gap: 15px; margin-top: 20px; padding: 20px; background: #edf2f7; border-radius: 8px; }
        .avatar { width: 60px; height: 60px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: bold; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
        .stat-card { background: white; padding: 25px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; }
        .stat-number { font-size: 2.5rem; font-weight: bold; color: #667eea; }
        .user-list { margin-top: 30px; }
        .user-card { background: white; padding: 20px; margin: 15px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); border-left: 4px solid #667eea; display: flex; justify-content: space-between; align-items: center; }
        .badge { background: #48bb78; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; }
    </style>
</head>
<body>
    <? include 'header.html' ?>
    
    <div class="container">
        <div class="welcome-card">
            <h1 style="color: #2d3748; margin-bottom: 10px;">{{ title }}</h1>
            <p style="color: #718096;">Welcome back, <strong>{{ user.name }}</strong>!</p>
            
            <div class="user-info">
                <div class="avatar">{{ user.name[0] }}</div>
                <div>
                    <div style="font-weight: 600; color: #2d3748;">{{ user.name }}</div>
                    <div style="color: #718096; font-size: 0.9rem;">{{ user.email }}</div>
                    <span class="badge">{{ user.role }}</span>
                </div>
            </div>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">{{ stats.totalUsers }}</div>
                <div style="color: #718096; margin-top: 5px;">Total Users</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">{{ stats.activeUsers }}</div>
                <div style="color: #718096; margin-top: 5px;">Active Now</div>
            </div>
        </div>

        <? if($showList): ?>
            <div class="user-list">
                <h2 style="color: #2d3748; margin-bottom: 20px;">Team Members</h2>
                <? foreach($users as $member): ?>
                    <div class="user-card">
                        <div>
                            <strong style="color: #2d3748; font-size: 1.1rem;">{{ member.name }}</strong>
                            <div style="color: #718096; font-size: 0.9rem; margin-top: 4px;">{{ member.email }}</div>
                        </div>
                        <span style="background: #e2e8f0; padding: 6px 14px; border-radius: 20px; color: #4a5568; font-size: 0.9rem;">Age: {{ member.age }}</span>
                    </div>
                <? endforeach; ?>
            </div>
        <? endif; ?>
        
        <div style="margin-top: 30px; text-align: center;">
            <a href="/profile/{{ user.name }}" style="display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; transition: transform 0.2s;">View My Profile</a>
        </div>
    </div>
    
    <? include 'footer.html' ?>
</body>
</html>`;


const profileTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ user.name }} - Profile</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', system-ui, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 40px 20px; }
        .profile-container { max-width: 600px; margin: 0 auto; }
        .profile-card { background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }
        .cover { height: 150px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); position: relative; }
        .profile-header { padding: 0 30px 30px; position: relative; }
        .profile-avatar { width: 120px; height: 120px; background: white; border-radius: 50%; margin: -60px auto 20px; display: flex; align-items: center; justify-content: center; font-size: 48px; color: #667eea; border: 5px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .profile-name { text-align: center; font-size: 1.8rem; color: #2d3748; margin-bottom: 5px; }
        .profile-role { text-align: center; color: #718096; margin-bottom: 20px; }
        .status-badge { display: inline-flex; align-items: center; gap: 6px; background: #48bb78; color: white; padding: 6px 16px; border-radius: 20px; font-size: 0.9rem; margin: 0 auto 30px; display: table; }
        .status-dot { width: 8px; height: 8px; background: white; border-radius: 50%; animation: pulse 2s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .info-section { padding: 30px; border-top: 1px solid #e2e8f0; }
        .info-grid { display: grid; gap: 20px; }
        .info-item { display: flex; align-items: center; gap: 15px; }
        .info-icon { width: 40px; height: 40px; background: #edf2f7; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #667eea; }
        .info-label { font-size: 0.875rem; color: #718096; margin-bottom: 4px; }
        .info-value { color: #2d3748; font-weight: 600; }
        .skills-section { padding: 30px; background: #f7fafc; }
        .skills-title { font-size: 1.1rem; color: #2d3748; margin-bottom: 15px; }
        .skill-tag { display: inline-block; background: white; color: #4a5568; padding: 8px 16px; margin: 5px; border-radius: 20px; font-size: 0.9rem; border: 1px solid #e2e8f0; }
        .back-link { text-align: center; margin-top: 30px; }
        .back-link a { color: white; text-decoration: none; font-weight: 600; padding: 12px 24px; background: rgba(255,255,255,0.2); border-radius: 8px; display: inline-block; transition: background 0.3s; }
        .back-link a:hover { background: rgba(255,255,255,0.3); }
    </style>
</head>
<body>
    <div class="profile-container">
        <div class="profile-card">
            <div class="cover"></div>
            <div class="profile-header">
                <div class="profile-avatar">{{ user.name[0] }}</div>
                <h1 class="profile-name">{{ user.name }}</h1>
                <p class="profile-role">{{ user.bio }}</p>
                
                <? if($isOnline): ?>
                    <div class="status-badge">
                        <span class="status-dot"></span>
                        Online Now
                    </div>
                <? else: ?>
                    <div class="status-badge" style="background: #a0aec0;">
                        <span class="status-dot" style="animation: none; opacity: 0.5;"></span>
                        Offline
                    </div>
                <? endif; ?>
            </div>
            
            <div class="info-section">
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-icon">✉</div>
                        <div>
                            <div class="info-label">Email</div>
                            <div class="info-value">{{ user.email }}</div>
                        </div>
                    </div>
                    <div class="info-item">
                        <div class="info-icon">📍</div>
                        <div>
                            <div class="info-label">Location</div>
                            <div class="info-value">{{ user.location }}</div>
                        </div>
                    </div>
                    <div class="info-item">
                        <div class="info-icon">🔗</div>
                        <div>
                            <div class="info-label">Website</div>
                            <div class="info-value"><a href="{{ user.website }}" style="color: #667eea; text-decoration: none;">{{ user.website }}</a></div>
                        </div>
                    </div>
                    <div class="info-item">
                        <div class="info-icon">📅</div>
                        <div>
                            <div class="info-label">Member Since</div>
                            <div class="info-value">{{ user.joined }}</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="skills-section">
                <h3 class="skills-title">Skills & Technologies</h3>
                <? foreach($skills as $skill): ?>
                    <span class="skill-tag">{{ skill }}</span>
                <? endforeach; ?>
            </div>
        </div>
        
        <div class="back-link">
            <a href="/mvc-demo">← Back to Dashboard</a>
        </div>
    </div>
</body>
</html>`;


const statusTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>User Status - {{ userName }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', system-ui, sans-serif; background: #f7fafc; min-height: 100vh; padding: 40px 20px; }
        .container { max-width: 800px; margin: 0 auto; }
        .status-card { background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.07); margin-bottom: 30px; }
        .status-header { text-align: center; margin-bottom: 30px; }
        .status-icon { width: 100px; height: 100px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; font-size: 48px; }
        .status-title { font-size: 2rem; margin-bottom: 10px; }
        .status-desc { color: #718096; font-size: 1.1rem; }
        
        /* Status-specific styles */
        .status-active .status-icon { background: #c6f6d5; color: #22543d; }
        .status-active .status-title { color: #22543d; }
        .status-pending .status-icon { background: #feebc8; color: #744210; }
        .status-pending .status-title { color: #744210; }
        .status-banned .status-icon { background: #fed7d7; color: #742a2a; }
        .status-banned .status-title { color: #742a2a; }
        .status-default .status-icon { background: #e2e8f0; color: #2d3748; }
        .status-default .status-title { color: #2d3748; }
        
        .info-box { background: #edf2f7; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
        .info-row:last-child { border-bottom: none; }
        .label { color: #718096; }
        .value { font-weight: 600; color: #2d3748; }
        
        .action-buttons { display: flex; gap: 15px; margin-top: 30px; justify-content: center; }
        .btn { padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; transition: all 0.3s; }
        .btn-primary { background: #667eea; color: white; }
        .btn-secondary { background: #e2e8f0; color: #4a5568; }
        .btn-danger { background: #fc8181; color: white; }
        .btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
        
        .alert { padding: 15px 20px; border-radius: 8px; margin: 20px 0; }
        .alert-warning { background: #feebc8; color: #744210; border-left: 4px solid #f6ad55; }
        .alert-danger { background: #fed7d7; color: #742a2a; border-left: 4px solid #fc8181; }
        .alert-success { background: #c6f6d5; color: #22543d; border-left: 4px solid #68d391; }
    </style>
</head>
<body>
    <div class="container">
        <? if($userStatus == 'active'): ?>
            <div class="status-card status-active">
                <div class="status-header">
                    <div class="status-icon">✓</div>
                    <h1 class="status-title">Account Active</h1>
                    <p class="status-desc">Welcome back, {{ userName }}! Your account is fully active.</p>
                </div>
                
                <div class="info-box">
                    <div class="info-row">
                        <span class="label">Role</span>
                        <span class="value">{{ role }}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Posts</span>
                        <span class="value">{{ postCount }}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Status</span>
                        <span class="value" style="color: #48bb78; text-transform: uppercase;">{{ userStatus }}</span>
                    </div>
                </div>
                
                <div class="alert alert-success">
                    ✓ You have full access to all features.
                </div>
                
                <div class="action-buttons">
                    <a href="/" class="btn btn-primary">Go to Dashboard</a>
                    <a href="/profile/{{ userName }}" class="btn btn-secondary">View Profile</a>
                </div>
            </div>
            
        <? elseif($userStatus == 'pending'): ?>
            <div class="status-card status-pending">
                <div class="status-header">
                    <div class="status-icon">⏳</div>
                    <h1 class="status-title">Account Pending</h1>
                    <p class="status-desc">Hi {{ userName }}, your account is awaiting approval.</p>
                </div>
                
                <div class="info-box">
                    <div class="info-row">
                        <span class="label">Current Role</span>
                        <span class="value">{{ role }}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Status</span>
                        <span class="value" style="color: #dd6b20; text-transform: uppercase;">{{ userStatus }}</span>
                    </div>
                </div>
                
                <div class="alert alert-warning">
                    ⏳ Your account is pending verification. Some features are restricted.
                </div>
                
                <div class="action-buttons">
                    <a href="/" class="btn btn-secondary">Back to Home</a>
                    <a href="/contact" class="btn btn-primary">Contact Support</a>
                </div>
            </div>
            
        <? elseif($userStatus == 'banned'): ?>
            <div class="status-card status-banned">
                <div class="status-header">
                    <div class="status-icon">🚫</div>
                    <h1 class="status-title">Account Banned</h1>
                    <p class="status-desc">Sorry {{ userName }}, your account has been suspended.</p>
                </div>
                
                <div class="info-box">
                    <div class="info-row">
                        <span class="label">Warning Level</span>
                        <span class="value" style="color: #e53e3e;">{{ warningLevel }}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Status</span>
                        <span class="value" style="color: #e53e3e; text-transform: uppercase;">{{ userStatus }}</span>
                    </div>
                </div>
                
                <div class="alert alert-danger">
                    🚫 Your account has been banned. Please contact support for more information.
                </div>
                
                <div class="action-buttons">
                    <a href="/" class="btn btn-secondary">Back to Home</a>
                    <a href="/appeal" class="btn btn-danger">Submit Appeal</a>
                </div>
            </div>
            
        <? else: ?>
            <div class="status-card status-default">
                <div class="status-header">
                    <div class="status-icon">❓</div>
                    <h1 class="status-title">Unknown Status</h1>
                    <p class="status-desc">Unable to determine account status for {{ userName }}.</p>
                </div>
                
                <div class="alert" style="background: #e2e8f0; color: #4a5568; border-left: 4px solid #a0aec0;">
                    ❓ Please contact support if you believe this is an error.
                </div>
                
                <div class="action-buttons">
                    <a href="/" class="btn btn-secondary">Back to Home</a>
                    <a href="/support" class="btn btn-primary">Contact Support</a>
                </div>
            </div>
        <? endif; ?>
        
        <div style="text-align: center; margin-top: 30px;">
            <p style="color: #718096;">Try different statuses:</p>
            <div style="margin-top: 15px;">
                <a href="/status/active" style="margin: 0 10px; color: #48bb78;">Active</a>
                <a href="/status/pending" style="margin: 0 10px; color: #dd6b20;">Pending</a>
                <a href="/status/banned" style="margin: 0 10px; color: #e53e3e;">Banned</a>
                <a href="/status/unknown" style="margin: 0 10px; color: #718096;">Unknown</a>
            </div>
        </div>
    </div>
</body>
</html>`;


fs.writeFileSync(path.join(viewsDir, 'header.html'), headerTemplate);
fs.writeFileSync(path.join(viewsDir, 'footer.html'), footerTemplate);
fs.writeFileSync(path.join(viewsDir, 'home.html'), homeTemplate);
fs.writeFileSync(path.join(viewsDir, 'profile.html'), profileTemplate);
fs.writeFileSync(path.join(viewsDir, 'status.html'), statusTemplate);

console.log(' View files created successfully!');
console.log('');
console.log(' Views created:');
console.log('   - views/header.html (partial)');
console.log('   - views/footer.html (partial)');
console.log('   - views/home.html (dashboard)');
console.log('   - views/profile.html (profile page)');
console.log('   - views/status.html (if/elseif/else demo)');
console.log('');
console.log(' Syntax Guide:');
console.log('   {{ variable }}              - Render variable');
console.log('   <? if($var): ?>             - If statement');
console.log('   <? elseif($var): ?>         - Else if statement');
console.log('   <? else: ?>                 - Else statement');
console.log('   <? endif; ?>                - End if');
console.log('   <? foreach($arr as $item): ?> - Loop');
console.log('   <? endforeach; ?>           - End loop');
console.log('   <? include "file.html" ?>   - Include partial');
