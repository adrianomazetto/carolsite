
/* script.js - Fofurices (versão final corrigida)
   - Compatível com planilhas:
     Produtos: id, categoria_id, nome, descricao, preco, imagem_url, disponivel
     Categorias: id, nome, icone
*/

const PLANILHA_ITENS = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQtVOmg6GQ7sGXiszWif20JcNJUigSDvCuGw-E3xifdQ2rhjYwGZPmtkY8g15A9LgsttNmAj7GIRfRw/pub?gid=725011201&single=true&output=csv';
const PLANILHA_CATEGORIAS = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQtVOmg6GQ7sGXiszWif20JcNJUigSDvCuGw-E3xifdQ2rhjYwGZPmtkY8g15A9LgsttNmAj7GIRfRw/pub?gid=1857146511&single=true&output=csv';

const KEY_PRODUCTS = 'fofurices_products_v1';
const KEY_CATEGORIES = 'fofurices_categories_v1';
const KEY_CART = 'fofurices_cart_v1';
const KEY_FAVORITES = 'fofurices_favorites_v1';

let produtos = [];
let categorias = [];
let categoriaAtivaId = null;

function formatarPreco(valor) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor || 0));
}

function salvarLocal(key, obj) {
    localStorage.setItem(key, JSON.stringify(obj || []));
}
function carregarLocal(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

function parseCSVLine(line) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') inQuotes = !inQuotes;
        else if (c === ',' && !inQuotes) { result.push(cur); cur = ''; }
        else cur += c;
    }
    result.push(cur);
    return result.map(s => s.replace(/^"|"$/g, '').trim());
}

function csvParaObjetos(csvText) {
    if (!csvText) return [];
    const linhas = csvText.trim().split(/\r?\n/).filter(Boolean);
    if (linhas.length < 1) return [];
    const header = parseCSVLine(linhas[0]);
    const dados = [];
    for (let i = 1; i < linhas.length; i++) {
        const vals = parseCSVLine(linhas[i]);
        const obj = {};
        for (let j = 0; j < header.length; j++) obj[header[j]] = vals[j] || '';
        if (obj.preco) obj.preco = parseFloat(String(obj.preco).replace(',', '.')) || 0;
        dados.push(obj);
    }
    return dados;
}

function converterUrlParaImagemDireta(url) {
    if (!url) return null;

    if (url.includes('drive.google.com')) {
        let fileId = null;
        // Tenta extrair o ID de URLs no formato /file/d/ID/...
        let match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (match) {
            fileId = match[1];
        } else {
            // Tenta extrair o ID de URLs no formato ?id=ID ou &id=ID
            match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
            if (match) {
                fileId = match[1];
            }
        }

        if (fileId) {
            // O formato thumbnail pode ser mais estável para exibir imagens.
            // sz=w1000 define a largura da imagem para 1000px.
            return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
        }
    } else if (url.startsWith('http')) {
        // Se não for um link do Google Drive, mas for um link http, usa diretamente.
        return url;
    }

    // Retorna nulo se não for uma URL válida ou não for possível extrair o ID.
    return null;
}

async function carregarPlanilhas() {
    const cachedProducts = carregarLocal(KEY_PRODUCTS);
    const cachedCategories = carregarLocal(KEY_CATEGORIES);
    if (cachedProducts.length) produtos = cachedProducts;
    if (cachedCategories.length) categorias = cachedCategories;

    try {
        const [rItens, rCats] = await Promise.all([fetch(PLANILHA_ITENS), fetch(PLANILHA_CATEGORIAS)]);
        if (!rItens.ok || !rCats.ok) return;
        const csvItens = await rItens.text();
        const csvCats = await rCats.text();
        produtos = csvParaObjetos(csvItens);
        categorias = csvParaObjetos(csvCats);
        salvarLocal(KEY_PRODUCTS, produtos);
        salvarLocal(KEY_CATEGORIES, categorias);
    } catch (err) { console.error('Erro ao carregar planilhas:', err); }
}

function renderizarCategoriasIndex() {
    const container = document.querySelector('.category-container');
    if (!container) return;
    container.innerHTML = '';
    const btnTodos = document.createElement('button');
    btnTodos.className = 'category-button default';
    btnTodos.textContent = 'Todos';
    btnTodos.onclick = () => { categoriaAtivaId = null; renderizarCategoriasIndex(); renderizarProdutosIndex(); };
    if (!categoriaAtivaId) btnTodos.classList.add('active');
    container.appendChild(btnTodos);
    categorias.forEach(cat => {
        const b = document.createElement('button');
        b.className = 'category-button default';
        b.textContent = `${cat.icone ? cat.icone + ' ' : ''}${cat.nome}`;
        b.onclick = () => { categoriaAtivaId = cat.id; renderizarCategoriasIndex(); renderizarProdutosIndex(); };
        if (categoriaAtivaId === cat.id) { b.classList.remove('default'); b.classList.add('active'); }
        container.appendChild(b);
    });
}

function renderizarProdutosIndex() {
    const container = document.getElementById('products-list');
    if (!container) return;
    container.innerHTML = '';
    const lista = produtos.filter(p => !categoriaAtivaId || p.categoria_id === categoriaAtivaId);
    if (!lista.length) { container.innerHTML = '<p style="text-align:center;color:#777">Nenhum produto encontrado.</p>'; return; }
    lista.forEach(item => {
        const card = document.createElement('div');
        card.className = 'product-card';
        const imgUrl = converterUrlParaImagemDireta(item.imagem_url);
        const imgHtml = imgUrl ? `<img class="product-image" alt="${item.nome}" src="${imgUrl}" loading="lazy">` :
            `<div class="product-image" style="display:flex;align-items:center;justify-content:center;height:140px;background:#fff;border:1px solid #333">Sem imagem</div>`;
        card.innerHTML = `
            ${imgHtml}
            <h3 class="product-name">${item.nome}</h3>
            <p class="product-price-value">${formatarPreco(item.preco)}</p>
            <div style="display:flex;gap:10px;margin-top:10px;align-items:center">
                <button class="add-to-cart-button small" data-id="${item.id}">ADICIONAR 🛒</button>
                <button class="favorite-button small" data-id="${item.id}" title="Favoritar">♡</button>
            </div>`;
        card.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            window.location.href = `produto.html?id=${encodeURIComponent(item.id)}`;
        });
        card.querySelector('.add-to-cart-button').onclick = ev => { ev.stopPropagation(); adicionarAoCarrinho(item.id, item); };
        const favBtn = card.querySelector('.favorite-button');
        favBtn.onclick = ev => { ev.stopPropagation(); toggleFavorito(item.id, item); atualizarIconeFavorito(favBtn, item.id); };
        atualizarIconeFavorito(favBtn, item.id);
        container.appendChild(card);
    });
}

function initPaginaProduto() {
    const nomeEl = document.querySelector('.product-name');
    if (!nomeEl) return;
    const id = new URLSearchParams(window.location.search).get('id');
    let produto = produtos.find(p => p.id === id);
    const renderProduto = (item) => {
        document.querySelectorAll('.product-name').forEach(n => n.textContent = item.nome);
        document.querySelectorAll('.product-price-value').forEach(p => p.textContent = formatarPreco(item.preco));
        const desc = document.querySelector('.product-description-text');
        if (desc) desc.innerHTML = `<p>${item.descricao}</p>`;
        const box = document.querySelector('.product-image-box');
        if (box) {
            const url = converterUrlParaImagemDireta(item.imagem_url);
            box.innerHTML = url ? `<img src="${url}" alt="${item.nome}" style="width:100%;height:100%;object-fit:contain">` : 'Sem imagem';
        }
        const add = document.querySelector('.add-to-cart-button');
        if (add) add.onclick = () => adicionarAoCarrinho(item.id, item);
        const fav = document.querySelector('.favorite-button');
        if (fav) { fav.onclick = () => { toggleFavorito(item.id, item); atualizarIconeFavorito(fav, item.id); }; atualizarIconeFavorito(fav, item.id); }
    };
    if (!produto) carregarPlanilhas().then(() => {
        produto = produtos.find(p => p.id === id);
        if (produto) renderProduto(produto);
        else nomeEl.textContent = 'Produto não encontrado';
    }); else renderProduto(produto);
}

function toggleFavorito(id, produtoObj) {
    const fav = carregarLocal(KEY_FAVORITES);
    const existe = fav.find(f => f.id === id);
    if (existe) salvarLocal(KEY_FAVORITES, fav.filter(f => f.id !== id));
    else fav.push(produtoObj), salvarLocal(KEY_FAVORITES, fav);
}

function atualizarIconeFavorito(btn, id) {
    const fav = carregarLocal(KEY_FAVORITES);
    btn.textContent = fav.find(f => f.id === id) ? '❤' : '♡';
}

function renderizarFavoritosPage() {
    const container = document.getElementById('favorites-list');
    if (!container) return;
    const fav = carregarLocal(KEY_FAVORITES);
    container.innerHTML = '';
    if (!fav.length) { container.innerHTML = '<div class="empty-favorites-message">Nenhum favorito ainda.</div>'; return; }
    fav.forEach(item => {
        const card = document.createElement('div');
        card.className = 'favorite-item-card';
        const imgUrl = converterUrlParaImagemDireta(item.imagem_url);
        card.innerHTML = `
            <div class="item-left"><div class="item-image-box" style="${imgUrl ? `background-image:url('${imgUrl}');background-size:cover;background-position:center` : ''}"></div></div>
            <div class="item-right">
                <div class="item-name">${item.nome}</div>
                <div class="item-actions">
                    <button class="add-to-cart-btn" data-id="${item.id}">🛒</button>
                    <button class="remove-btn" data-id="${item.id}">🗑</button>
                </div>
            </div>`;
        card.querySelector('.add-to-cart-btn').onclick = () => adicionarAoCarrinho(item.id, item);
        card.querySelector('.remove-btn').onclick = () => {
            const novos = fav.filter(f => f.id !== item.id);
            salvarLocal(KEY_FAVORITES, novos); renderizarFavoritosPage();
        };
        container.appendChild(card);
    });
}

function obterCarrinho() { return carregarLocal(KEY_CART); }
function salvarCarrinho(novo) { salvarLocal(KEY_CART, novo); }

function adicionarAoCarrinho(id, produtoObj) {
    const carrinho = obterCarrinho();
    const existe = carrinho.find(it => it.id === id);
    if (existe) existe.quantidade++; else carrinho.push({ ...produtoObj, quantidade: 1 });
    salvarCarrinho(carrinho); renderizarCarrinhoPage();
}

function removerDoCarrinho(id) {
    salvarCarrinho(obterCarrinho().filter(i => i.id !== id));
    renderizarCarrinhoPage();
}

function alterarQuantidadeCarrinho(id, novaQtd) {
    const carrinho = obterCarrinho();
    const item = carrinho.find(i => i.id === id);
    if (!item) return;
    if (novaQtd <= 0) return removerDoCarrinho(id);
    item.quantidade = novaQtd;
    salvarCarrinho(carrinho); renderizarCarrinhoPage();
}

function renderizarCarrinhoPage() {
    const container = document.getElementById('cart-list');
    if (!container) return;
    const carrinho = obterCarrinho();
    container.innerHTML = '';
    if (!carrinho.length) { container.innerHTML = '<div style="text-align:center;padding:40px;color:#777">Carrinho vazio</div>'; return; }
    carrinho.forEach(item => {
        const card = document.createElement('div');
        card.className = 'cart-item-card';
        const imgUrl = converterUrlParaImagemDireta(item.imagem_url);
        card.innerHTML = `
            <div class="item-left"><div class="item-image-box" style="${imgUrl ? `background-image:url('${imgUrl}');background-size:cover;background-position:center` : ''}"></div></div>
            <div class="item-right">
                <div class="item-name">${item.nome}</div>
                <div class="item-price-label">${formatarPreco(item.preco)}</div>
                <div class="item-controls">
                    <div class="quantity-control-box">
                        <button class="quantity-arrow dec" data-id="${item.id}">−</button>
                        <div class="quantity-value">${item.quantidade}</div>
                        <button class="quantity-arrow inc" data-id="${item.id}">+</button>
                    </div>
                    <button class="remove-btn" data-id="${item.id}">🗑</button>
                </div>
            </div>`;
        card.querySelector('.dec').onclick = () => alterarQuantidadeCarrinho(item.id, item.quantidade - 1);
        card.querySelector('.inc').onclick = () => alterarQuantidadeCarrinho(item.id, item.quantidade + 1);
        card.querySelector('.remove-btn').onclick = () => removerDoCarrinho(item.id);
        container.appendChild(card);
    });
    const total = carrinho.reduce((s, i) => s + i.preco * i.quantidade, 0);
    const totalDiv = document.createElement('div');
    totalDiv.style = 'text-align:right;margin-top:20px;font-weight:bold';
    totalDiv.textContent = `TOTAL: ${formatarPreco(total)}`;
    container.appendChild(totalDiv);
}

async function initApp() {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading-screen';
    loadingDiv.textContent = 'Carregando fofurices... 💖';
    loadingDiv.style = 'position:fixed;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#fff;font-family:"Press Start 2P";z-index:9999;color:#6b3c2a;';
    document.body.appendChild(loadingDiv);
    await carregarPlanilhas();
    await new Promise(r => setTimeout(r, 400));

    if (document.getElementById('products-list')) { renderizarCategoriasIndex(); renderizarProdutosIndex(); }
    if (document.querySelector('.product-name')) initPaginaProduto();
    if (document.getElementById('favorites-list')) renderizarFavoritosPage();
    if (document.getElementById('cart-list')) renderizarCarrinhoPage();

    document.querySelectorAll('.icon-btn').forEach(btn => {
        const ico = btn.querySelector('i');
        if (!ico) return;
        if (ico.classList.contains('fa-shopping-bag')) btn.onclick = () => location.href = 'carrinho.html';
        if (ico.classList.contains('fa-heart')) btn.onclick = () => location.href = 'favoritos.html';
    });
    loadingDiv.remove();
}
document.addEventListener('DOMContentLoaded', initApp);
