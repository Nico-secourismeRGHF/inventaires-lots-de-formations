/* Adaptateur : fournit à l'application l'interface « window.claude.use('db' | 'user' | 'downloads') »
   à partir de Firebase (Authentication + Firestore) et d'un téléchargement navigateur standard. */
(function(){
  var V='10.14.1', BASE='https://www.gstatic.com/firebasejs/'+V+'/';
  var mods=null;

  async function load(){
    if(mods) return mods;
    var cfg=window.FIREBASE_CONFIG;
    if(!cfg||!cfg.apiKey||/COLLER|YOUR_/i.test(cfg.apiKey)) throw new Error('Configuration Firebase manquante (public/firebase-config.js).');
    var r=await Promise.all([import(BASE+'firebase-app.js'),import(BASE+'firebase-auth.js'),import(BASE+'firebase-firestore.js')]);
    var A=r[0], AU=r[1], FS=r[2];
    var app=A.initializeApp(cfg);
    mods=Object.assign({},AU,FS,{auth:AU.getAuth(app),db:FS.getFirestore(app)});
    return mods;
  }

  function loginMessage(code){
    if(/invalid-credential|wrong-password|user-not-found|invalid-email/.test(code||'')) return 'Identifiants incorrects.';
    if(/too-many-requests/.test(code||'')) return 'Trop de tentatives, réessayez plus tard.';
    if(/network/.test(code||'')) return 'Connexion Internet indisponible.';
    if(/unauthorized-domain/.test(code||'')) return "Domaine non autorisé : ajoutez "+location.hostname+" dans Firebase > Authentication > Paramètres > Domaines autorisés.";
    if(/operation-not-allowed/.test(code||'')) return "Connexion par e-mail/mot de passe non activée dans Firebase > Authentication.";
    return 'Connexion impossible ('+(code||'erreur')+').';
  }

  function showLogin(m){
    return new Promise(function(resolve){
      var ov=document.createElement('div');
      ov.style.cssText='position:fixed;inset:0;background:rgba(20,28,38,.85);z-index:100;display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,sans-serif';
      ov.innerHTML='<form style="background:#fff;color:#1c2420;border-radius:12px;padding:22px;max-width:360px;width:100%;display:flex;flex-direction:column;gap:10px">'+
        '<h2 style="margin:0 0 4px;font-size:18px">Connexion</h2>'+
        '<p style="margin:0;font-size:13px;color:#5a6470">Registre d\'inventaire — Lots PSC / STG</p>'+
        '<input id="fbEmail" type="email" autocomplete="username" placeholder="Adresse e-mail" required style="padding:10px;border:1px solid #d8d3c6;border-radius:6px;font-size:15px">'+
        '<input id="fbPass" type="password" autocomplete="current-password" placeholder="Mot de passe" required style="padding:10px;border:1px solid #d8d3c6;border-radius:6px;font-size:15px">'+
        '<p id="fbErr" style="margin:0;color:#9a2f28;font-size:13px;min-height:16px"></p>'+
        '<button type="submit" style="padding:11px;border:0;border-radius:6px;background:#1c2b3a;color:#fff;font-weight:700;font-size:15px;cursor:pointer">Se connecter</button></form>';
      document.body.appendChild(ov);
      var form=ov.querySelector('form');
      form.addEventListener('submit',async function(e){
        e.preventDefault();
        ov.querySelector('#fbErr').textContent='';
        try{
          var cred=await m.signInWithEmailAndPassword(m.auth,ov.querySelector('#fbEmail').value.trim(),ov.querySelector('#fbPass').value);
          ov.remove(); addSignOut(m); resolve(cred.user);
        }catch(err){ ov.querySelector('#fbErr').textContent=loginMessage(err&&err.code); }
      });
    });
  }

  function addSignOut(m){
    if(document.getElementById('fbSignOut')) return;
    var b=document.createElement('button');
    b.id='fbSignOut'; b.type='button';
    b.textContent='Déconnexion'+(m.auth.currentUser&&m.auth.currentUser.email?' ('+m.auth.currentUser.email+')':'');
    b.style.cssText='position:fixed;top:6px;right:8px;z-index:60;font-size:11px;padding:4px 8px;border-radius:6px;border:1px solid rgba(255,255,255,.4);background:rgba(28,43,58,.85);color:#fff;cursor:pointer';
    b.addEventListener('click',async function(){ await m.signOut(m.auth); location.reload(); });
    document.body.appendChild(b);
  }

  function ensureUser(m){
    return new Promise(function(resolve){
      var un=m.onAuthStateChanged(m.auth,function(u){
        un();
        if(u){ addSignOut(m); resolve(u); } else showLogin(m).then(resolve);
      });
    });
  }

  // {items:{5:{status:'P'}}} -> {'items.5.status':'P'} (fusion champ par champ, comme update() attendu par l'application)
  function flat(obj,prefix,out){
    out=out||{};
    Object.keys(obj).forEach(function(k){
      var v=obj[k], p=prefix?prefix+'.'+k:k;
      if(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length) flat(v,p,out); else out[p]=v;
    });
    return out;
  }

  function makeDb(m){
    function wrapDoc(path){
      var ref=m.doc(m.db,path);
      return {
        id:ref.id,
        get:async function(){ var s=await m.getDoc(ref); return {id:s.id,exists:s.exists(),data:function(){ return s.data(); }}; },
        set:async function(b){ await m.setDoc(ref,b); },
        update:async function(b){ await m.updateDoc(ref,flat(b)); },
        delete:async function(){ await m.deleteDoc(ref); }
      };
    }
    return {
      doc:wrapDoc,
      collection:function(c){
        var col=m.collection(m.db,c);
        return {
          doc:function(id){ return wrapDoc(c+'/'+id); },
          onSnapshot:function(fn,errFn){
            return m.onSnapshot(col,function(s){
              fn({docs:s.docs.map(function(d){ return {id:d.id,exists:true,data:function(){ return d.data(); }}; })});
            },function(err){
              window.FIREBASE_ERROR=(err&&err.code==='permission-denied')?"accès refusé par les règles Firestore (votre e-mail doit figurer dans firestore.rules, puis « firebase deploy --only firestore:rules »)":((err&&(err.code||err.message))||'erreur Firestore');
              console.error('Firestore:',err); if(errFn) errFn(err);
            });
          }
        };
      }
    };
  }

  window.claude={
    use:async function(name){
      if(name==='downloads'){
        return { save:async function(o){
          var url=URL.createObjectURL(o.data), a=document.createElement('a');
          a.href=url; a.download=o.filename; document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function(){ URL.revokeObjectURL(url); },4000);
        }};
      }
      if(name==='db'){
        try{ var m=await load(); await ensureUser(m); return makeDb(m); }
        catch(e){ window.FIREBASE_ERROR=(e&&(e.message||e.code))||'erreur inconnue'; console.error('Firebase:',e); throw e; }
      }
      if(name==='user'){ var m2=await load(); return { can:async function(){ return !!m2.auth.currentUser; } }; }
      return null;
    }
  };
})();
