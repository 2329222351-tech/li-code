"use strict";
window.createNightShift=function(ctx){
  const {scene,camera,state:S,game:G,colliders,objects,surfaces,psMat,labelTexture,audio}=ctx;
  const st={started:false,intro:false,good:0,eaten:0,shiftDone:false,eavesdrop:false,office:false,
    thought:false,visited2:false,valve:false,anger:0,hidden:false,exposed:false,gun:false,ammo:0,
    pumpOff:false,unplugged:false,escapeTime:0,leaving:false,foam:0,caught:0,capturing:false,arcadeChase:false};
  const npc={pos:new THREE.Vector3(-15.3,0,-4.17),yaw:0,state:'PATROL',zone:0,route:0,path:[],pathAt:0,
    last:new THREE.Vector3(),lost:0,search:0,stun:0,wait:1,repath:0,seen:false,cooldown:0,travel:0};
  const events=[];let elapsed=0,work=false,workT=0,cursor=0,breathT=0,noiseT=0,officeHum=null,footAt=0;
  let hiddenCabinet=null,capturePose=null,coworkerModel=null,coworkerMode='WAIT',coworkerPath=[],coworkerAt=0;
  let arcade=null,arcadeTexture=null;const fans=[];
  const group=new THREE.Group();group.name='夜班剧情与遮挡';scene.add(group);
  const add=(name,o)=>{o.name=name;group.add(o);objects.push({name,obj:o});return o;};
  function box(name,x,z,w,d,h,color,wall){
    const m=add(name,new THREE.Mesh(new THREE.BoxGeometry(w,h,d,Math.max(1,Math.ceil(w/2)),2,Math.max(1,Math.ceil(d/2))),psMat({color})));
    m.position.set(x,h/2,z);const c={type:'box',x,z,w,d,h,wall:!!wall};colliders.push(c);return {mesh:m,col:c};
  }
  function sign(text,x,y,z,angle,width=2.4){
    const m=add(text[0],new THREE.Mesh(new THREE.PlaneGeometry(width,0.66),psMat({map:labelTexture(text,'#1e2827','#c2c9ab',{w:256,h:80,size:23}),lit:false,side:THREE.DoubleSide})));
    m.position.set(x,y,z);m.rotation.y=angle||0;return m;
  }
  function prop(id,x,z,label,action,radius=1.8){return MF.register({id,pos:{x,z},radius,label:typeof label==='function'?label:()=>label,action});}
  function later(delay,fn){events.push({at:elapsed+delay,fn});}
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  const insideOffice=p=>p.x>-20.8&&p.x<-13.15&&p.z>-7.8&&p.z<1.8;
  const inSafe=p=>(p.x>13.4&&p.x<20.7&&p.z>-17.7&&p.z<-6.3)||(p.x<-13.4&&p.x>-20.7&&p.z>-67.7&&p.z<-56.3);
  const uiBusy=()=>MF.dialogOpen()||MF.confirmOpen()||MF.dancing()||document.getElementById('mf-ending').classList.contains('on');

  box('遮挡·废弃压缩机',-9.24,-21.63,2.4,1.6,1.9,0x566460);
  box('遮挡·压缩机检修屏',-10.7,-22.1,0.28,3,2.35,0x65736c);
  box('遮挡·压缩机备件箱',-7.8,-23.6,1.2,0.9,0.8,0x756c56);
  sign(['停用设备','请绕行'], -9.24,2.25,-20.8,0,1.8);
  box('办公室档案柜',-20.3,0.7,1.1,0.65,2.2,0x444f50);
  sign(['孙笑川办公室','未经许可 禁止入内'], -12.87,2.3,-6,Math.PI/2,2);
  const record=add('办公室夜班档案',new THREE.Mesh(new THREE.BoxGeometry(0.42,0.035,0.3),psMat({color:0xc1baa0})));
  record.position.set(-16.45,0.89,-4.17);
  sign(['01 灌装厂','工位 / 监控室 →'],4.2,2.3,5,Math.PI/2);
  sign(['02 发酵厂','沿黄线前行'], -3.3,2.25,-45.8,0);
  sign(['安全屋 ←','关闭铁门，不要出声'], -9.6,2.25,-61.8,Math.PI/2);
  sign(['03 主泵室','里面有人在说话'],0,2.4,-101.8,0);
  box('遮挡·东侧配电柜',6.4,-12.7,2.2,0.8,2.35,0x475551);
  box('遮挡·东侧封箱屏',5.6,-28,3.8,0.65,2.25,0x706754);
  box('遮挡·西侧机房屏',-7.9,-29,3.4,0.65,2.4,0x596463);
  box('遮挡·交错发酵屏 A',1.6,-64.7,3.3,0.5,2.25,0x637067);
  box('遮挡·交错发酵屏 B',-1.8,-78.7,3.2,0.5,2.25,0x637067);
  box('遮挡·南端堆垛屏',-3.57,-93.43,3.6,0.55,2.45,0x637067);
  box('遮挡·南端备件柜',-6.2,-95.8,1.2,2.2,2.1,0x4e5a56);
  box('遮挡·南端回收箱',-1.4,-96.2,1.35,1.1,1.35,0x7b7159);
  box('遮挡·南端横置机箱',-4.8,-90.5,1.5,1.1,1.8,0x566460);
  sign(['维修物料','保持中央通道畅通'], -3.57,2.12,-93.13,0,2.2);
  const cabinets=[];
  function makeCabinet(x,z,angle){
    const id='night-hide-'+cabinets.length,root=add('躲藏柜 '+(cabinets.length+1),new THREE.Group());
    root.position.set(x,0,z);root.rotation.y=angle;
    const mat=psMat({color:0x52635d}),dark=psMat({color:0x222d29});
    const part=(w,h,d,px,py,pz,m=mat)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(px,py,pz);root.add(mesh);};
    part(0.96,2.35,0.06,0,1.175,-0.33);part(0.06,2.35,0.72,-0.45,1.175,0);part(0.06,2.35,0.72,0.45,1.175,0);
    part(0.96,0.06,0.72,0,2.32,0);part(0.96,0.08,0.72,0,0.04,0,dark);
    part(0.84,1.36,0.06,0,0.68,0.33);part(0.84,0.89,0.06,0,1.905,0.33);part(0.06,0.22,0.04,0.3,1.06,0.38,dark);
    const fx=Math.sin(angle),fz=Math.cos(angle),side=Math.abs(fx)>0.5;
    const col={type:'box',x,z,w:side?0.72:0.96,d:side?0.96:0.72,h:2.35};colliders.push(col);
    const c={id,x,z,angle,root,col,front:{x:x+fx*0.9,y:1.4,z:z+fz*0.9},exit:{x:x+fx*1.18,y:1.35,z:z+fz*1.18}};
    sign(['清洁柜','E 躲藏'],x+fx*0.38,1.88,z+fz*0.38,angle,0.77);cabinets.push(c);return c;
  }
  [[10,-94,0],[12.09,-18.12,-Math.PI/2],[-12.36,-17.13,Math.PI/2],[-12.37,-85.91,Math.PI/2],
    [16.09,-94.45,0],[-14.84,-118.71,Math.PI/2],[-5.50,-101.46,0]].forEach(p=>makeCabinet(...p));
  const gun=add('安全屋气压镇静枪',new THREE.Group());gun.position.set(-16,1.02,-57.2);
  const barrel=new THREE.Mesh(new THREE.BoxGeometry(0.48,0.14,0.14),psMat({color:0x899494}));gun.add(barrel);
  const grip=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.23,0.14),psMat({color:0x374038}));grip.position.set(-0.1,-0.15,0);gun.add(grip);
  sign(['气压镇静枪 / 3 发','G 瞄准射击 · 只会暂时击晕'], -16,1.6,-57.5,0,2.3);
  [[4,2,4,-18],[4,-18,4,-36],[-3.3,-38,-3.3,-45],[0,-57,0,-61],[0,-87,0,-99]].forEach(a=>{
    const d=Math.hypot(a[2]-a[0],a[3]-a[1]);const m=add('磨损导向线',new THREE.Mesh(new THREE.PlaneGeometry(0.07,d),psMat({color:0xc5ac5c,lit:false,transparent:true,opacity:0.26})));
    m.rotation.x=-Math.PI/2;m.position.set((a[0]+a[2])/2,0.027,(a[1]+a[3])/2);
  });
  const coworker=add('同事 NO.07',new THREE.Group());coworker.position.set(3.12,0,6.37);
  const coworkerSeat=add('NO.07 游戏座椅',new THREE.Group());coworkerSeat.position.set(6.99,0,10.54);
  const seatMat=psMat({color:0x4a5145});
  const seat=new THREE.Mesh(new THREE.BoxGeometry(0.65,0.12,0.6),seatMat);seat.position.y=0.5;coworkerSeat.add(seat);
  [-0.25,0.25].forEach(x=>[-0.23,0.23].forEach(z=>{const leg=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.48,0.06),seatMat);leg.position.set(x,0.24,z);coworkerSeat.add(leg);}));
  const desk=box('NO.07 掌机台',6.99,11.05,1.05,0.5,0.88,0x535c50);
  const handheld=add('NO.07 掌机',new THREE.Mesh(new THREE.BoxGeometry(0.36,0.06,0.22),psMat({color:0x96b27e,lit:false})));
  handheld.position.set(6.99,0.94,10.94);
  const arcadeBody=box('俄罗斯方块街机',6.51,6.87,0.72,1.05,1.85,0x334d48);
  sign(['TETRIS / 休息机','工作时间请勿超过 20 秒'],6.9,2.14,6.87,Math.PI/2,1.5);
  const arcadeScreen=add('街机 CRT',new THREE.Mesh(new THREE.PlaneGeometry(0.52,0.9),new THREE.MeshBasicMaterial({color:0xffffff})));
  arcadeScreen.rotation.y=Math.PI/2;arcadeScreen.position.set(6.885,1.23,6.87);
  const controls=add('街机操作台',new THREE.Mesh(new THREE.BoxGeometry(0.24,0.13,0.9),psMat({color:0x64766b})));
  controls.position.set(6.95,0.75,6.87);
  function ceilingFan(x,z,ceiling){
    const root=add('吊扇',new THREE.Group());root.position.set(x,ceiling-0.1,z);
    const mat=psMat({color:0x455552}),rod=new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.045,0.75,6),mat);rod.position.y=-0.375;root.add(rod);
    const rotor=new THREE.Group();rotor.position.y=-0.78;root.add(rotor);
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.16,0.16,10),mat);rotor.add(hub);
    for(let i=0;i<4;i++){const arm=new THREE.Group();arm.rotation.y=i*Math.PI/2;const blade=new THREE.Mesh(new THREE.BoxGeometry(0.85,0.035,0.2),mat);blade.position.x=0.57;blade.rotation.x=0.13;arm.add(blade);rotor.add(arm);}
    fans.push(rotor);
  }
  [[-4.7,-11,5.2],[4.7,-27,5.2],[0,-41,5.2],[0,-58,5],[0,-75,5],[0,-93,5]].forEach(p=>ceilingFan(...p));
  ctx.hideSlime();ctx.freeChair();

  const style=document.createElement('style');style.textContent=`
    #night-status{position:fixed;right:22px;top:80px;z-index:25;color:#cccbb5;font:12px monospace;letter-spacing:1px;text-align:right;pointer-events:none}
    #night-status strong{display:block;font-size:16px;margin:7px 0;color:#bdc990}#night-status.danger strong{color:#e69982}
    #night-work{display:none;position:fixed;left:50%;bottom:8%;transform:translateX(-50%);width:min(470px,90vw);z-index:45;padding:22px;background:#101916f2;border:1px solid #94a47b;color:#dfe2cd;font:14px monospace}
    #night-work.on{display:block}#night-track{height:34px;background:#35433c;position:relative;margin:20px 0}#night-target{position:absolute;left:40%;width:24%;height:100%;background:#a1b776}#night-cursor{position:absolute;top:-4px;height:42px;width:4px;background:#fff}
    #night-work button,#night-shoot{background:#25352e;border:1px solid #849579;color:#e0e3d3;padding:10px;margin:4px;cursor:pointer;font:12px monospace}#night-work p{font-size:12px;color:#a6b09e;line-height:1.7}
    #night-hide{display:none;position:fixed;inset:0;pointer-events:none;z-index:28;background:linear-gradient(#080d0bec 0%,#080d0bec 42%,transparent 43%,transparent 53%,#080d0bf5 54%)}#night-hide.on{display:block}
    #night-hide span{position:absolute;bottom:20%;width:100%;text-align:center;color:#adb8a0;font:13px monospace}
    #night-shoot{position:fixed;right:24px;bottom:120px;z-index:35;display:none}#sceneBar{display:none!important}.dev-open #sceneBar.on{display:flex!important}
    #hudGoal{max-width:300px;line-height:1.7}#mf-hint{max-width:90vw;white-space:normal;text-align:center}
    body:not(.dev-open) #dpad button[data-k="KeyR"],body:not(.dev-open) #dpad button[data-k="KeyQ"]{visibility:hidden}
    #mfPanel{display:none}.dev-open #mfPanel,.inventory-open #mfPanel{display:block}#night-bag{position:fixed;right:24px;bottom:76px;z-index:35;background:#17221ddd;border:1px solid #65775d;color:#bec6b3;padding:8px;cursor:pointer}
  `;document.head.appendChild(style);
  const ui=document.createElement('div');ui.innerHTML=`<div id="night-status" hidden>夜班 / NO.13<strong></strong><span></span></div>
    <div id="night-work"><b>灌装工位 · 点击停在浅绿色区域</b><div id="night-track"><i id="night-target"></i><i id="night-cursor"></i></div><div id="night-result">合格 0 / 3</div><p>工位灯在闪。办公室那边却传来和机器不同的声音。</p><button id="night-stop">封盖 / 鼠标点击</button><button id="night-eat">偷吃一瓶</button><button id="night-stand">离开工位</button></div>
    <div id="night-hide"><span>躲在清洁柜中 · E 离开 · 脚步声仍在外面</span></div><button id="night-shoot">G · 镇静枪</button><button id="night-bag">背包 / B</button>`;
  document.body.appendChild(ui);
  const statusEl=document.getElementById('night-status'),workEl=document.getElementById('night-work');
  const resultEl=document.getElementById('night-result'),cursorEl=document.getElementById('night-cursor');
  const hideEl=document.getElementById('night-hide'),shootEl=document.getElementById('night-shoot');

  function closeWork(){work=false;workEl.classList.remove('on');ctx.clearKeys();ctx.standUp();}
  function openWork(){if(uiBusy()||st.capturing)return;finishArcadeChase();if(arcade)arcade.close();work=true;workT=0;workEl.classList.add('on');ctx.clearKeys();ctx.setPose(2.45,1.35,-16.96,Math.PI/2);resultEl.textContent='合格 '+st.good+' / 3 · 偷吃 '+st.eaten+' 瓶';}
  function completeShift(){if(st.shiftDone||st.good<3)return;st.shiftDone=true;MF.state.inv.floorKey=true;MF.state.inv.backpack=true;MF.refreshPanel();
    closeWork();audio.play('sfx_pa_static',0.22);MF.dialog('下班广播',['本班产量达标。第 13 号，钥匙已经放进你的背包。','右侧监控室的绿色出口通向停车场。你可以直接开车走。','（办公室的声音还没停。西侧厕所的通风管里，似乎有人在哭。）']);refreshHint();}
  function stopWork(){if(!work||S.pause||document.hidden)return;const ok=cursor>=0.4&&cursor<=0.64;
    if(ok){st.good=Math.min(3,st.good+1);audio.play('sfx_lock_turn',0.28);}else{audio.play('sfx_vending_beep',0.2);setAnger(st.anger+5);}
    resultEl.textContent=(ok?'封盖合格':'偏了，可以继续试')+' · '+st.good+' / 3';workT=0;
    completeShift();}
  function eat(){if(!work||S.pause||document.hidden)return;st.eaten++;MF.state.happy=Math.min(100,MF.state.happy+20);MF.state.milk=Math.min(100,MF.state.milk+5);audio.play('sfx_swallow',0.45);MF.refreshPanel();
    resultEl.textContent='偷吃 '+st.eaten+' 瓶 · 合格 '+st.good+' / 3';
    if(st.eaten===3){closeWork();ctx.startLaugh();setAnger(40);npc.last.set(3.2,0,-17);npc.state='INVESTIGATE';npc.path=[];npc.repath=0;
      [0.25,0.7,1.15].forEach((d,i)=>later(d,()=>{const a=audio.play('sfx_frog_laugh_raw',0.2-i*0.035);if(a){a.playbackRate=0.88+i*0.12;later(3.5-i*0.5,()=>{a.pause();audio.playing.delete(a);});}}));
      later(2,()=>{audio.play('sfx_sc_roar',0.65);MF.dialog('孙笑川',['そんなに大声を出して、何をしているんだ！','遊んでいないで、持ち場に戻れ！'],()=>MF.dialog('NO.07',['（办公室门口响起脚步声。NO.07 把笑憋了回去。）','先把三瓶合格品做完。想查那些声音，下班后去厕所听。']));});
    }
    refreshHint();}
  document.getElementById('night-stop').onclick=stopWork;document.getElementById('night-eat').onclick=eat;document.getElementById('night-stand').onclick=closeWork;
  document.getElementById('view').addEventListener('click',()=>{if(work)stopWork();});
  MF.unregister('chair');MF.unregister('seated');
  prop('night-work',2.8,-16.96,()=>st.shiftDone?'回到工位（可以继续偷吃）':'上工 · 封盖小游戏',openWork,2);
  const coworkerProp=prop('coworker',3.12,6.37,'问问 NO.07',()=>MF.dialog('NO.07',['喂，第 13 号，别在传送带上摸鱼。','沿右侧黄线走到黄色操作椅。把划线停在浅绿色那段，三瓶就能下班。','我去调试室玩会儿游戏。你别玩太久，超过二十秒他会来抓你，赶紧回工位。'],sendCoworkerToSeat));
  arcade=createNightArcade({canInput:()=>S.started&&!S.pause&&!document.hidden&&!uiBusy()&&!st.capturing,onClose:()=>ctx.clearKeys(),onTimeout:()=>{
    st.arcadeChase=true;setAnger(Math.max(70,st.anger));npc.state='CHASE';npc.last.copy(camera.position);npc.path=[];npc.repath=0;npc.cooldown=0;npc.lost=0;
    audio.play('sfx_sc_roar',0.65);MF.dialog('孙笑川',['仕事中にゲームだと？今すぐ持ち場に戻れ！']);refreshHint();
  }});
  arcadeTexture=new THREE.CanvasTexture(arcade.textureCanvas);arcadeTexture.magFilter=THREE.NearestFilter;arcadeScreen.material.map=arcadeTexture;
  prop('night-arcade',7.5,6.87,()=>st.arcadeChase?'他正在找你，先回工位':'玩俄罗斯方块（超过 20 秒会被发现）',()=>{
    if(st.arcadeChase){MF.toast('先回黄色操作椅，别再摸鱼了。');return;}
    ctx.standUp();ctx.clearKeys();ctx.setPose(7.85,1.35,6.87,Math.PI/2);arcade.open();
  },1.75);
  function finishArcadeChase(){if(!st.arcadeChase)return;st.arcadeChase=false;setAnger(st.valve?85:st.office?65:40);npc.state='PATROL';npc.path=[];npc.repath=0;npc.cooldown=8;npc.seen=false;MF.toast('你回到了工位。孙笑川停止追赶，继续巡逻。');}
  prop('toilet-think',-14.5,-15.5,'在厕所静一静 / 听通风管',()=>{
    st.thought=true;st.eavesdrop=true;audio.play('amb_distant_whispers',0.32);
    MF.dialog('奶蛙 · 厕所沉思',['管道里传来一声：「爸爸，我不想喝奶了……」','孙笑川的办公室在西侧靠近传送带起点的房间，桌上放着夜班记录。进去会被发现。','NO.07 说：厂2也有这样的声音。沿传送带走到尽头，左侧门廊通往发酵厂。','你可以就此离开。但那声音听起来……不像机器。']);refreshHint();},2);
  prop('office-record',-16.12,-4.17,'查看办公室的夜班记录',()=>{
    st.office=true;setAnger(65);npc.last.copy(camera.position);npc.state='INVESTIGATE';npc.repath=0;
    MF.dialog('夜班记录',['「试饮员不是员工。它们是原料。」','桌下的录音机还在反复播放一个孩子的声音。'],()=>MF.dialog('孙笑川',['誰の許可で入ってきたんだ？']));audio.play('sfx_sc_attitude',0.6);refreshHint();},1.75);
  prop('stungun',-16,-57.2,()=>st.gun?'补充镇静弹（3 发）':'拿起镇静枪（G 射击）',()=>{st.gun=true;st.ammo=3;gun.visible=false;shootEl.style.display='block';MF.toast('G 瞄准射击，击晕 6 秒。不要隔着墙浪费子弹。');});
  cabinets.forEach(c=>prop(c.id,c.front.x,c.front.z,()=>st.hidden?'离开清洁柜':'躲入清洁柜',()=>{
    if(st.hidden){exitHide();return;}
    st.exposed=npc.seen&&distance(npc.pos,camera.position)<9;st.hidden=true;hiddenCabinet=c;ctx.standUp();ctx.clearKeys();hideEl.classList.add('on');pinCabinet();
    if(st.exposed){npc.last.set(c.front.x,0,c.front.z);npc.state='INVESTIGATE';npc.path=[];npc.repath=0;npc.search=0;MF.toast('他看见你进柜子了。脚步声正在靠近。');}
    refreshHint();},1.8));
  function pinCabinet(){const c=hiddenCabinet;ctx.setPose(c.x+Math.sin(c.angle)*0.04,1.42,c.z+Math.cos(c.angle)*0.04,c.angle+Math.PI);}
  function exitHide(){if(!hiddenCabinet)return;const c=hiddenCabinet;st.hidden=false;st.exposed=false;hiddenCabinet=null;hideEl.classList.remove('on');ctx.setPose(c.exit.x,c.exit.y,c.exit.z,c.angle+Math.PI);ctx.clearKeys();refreshHint();}
  function shoot(){if(!st.gun||work||st.hidden||(arcade&&arcade.isOpen())||st.capturing||uiBusy()||S.pause||!S.started)return;if(st.ammo<=0){MF.toast('空枪。安全屋桌上还有镇静弹。');return;}st.ammo--;
    const d=distance(camera.position,npc.pos),dx=npc.pos.x-camera.position.x,dz=npc.pos.z-camera.position.z;
    const aim=(-Math.sin(ctx.getYaw())*dx-Math.cos(ctx.getYaw())*dz)/Math.max(d,0.01);
    audio.play('sfx_pa_static',0.65);
    if(d<15&&aim>0.9&&lineClear({...camera.position,y:1.4},{...npc.pos,y:1.4})){npc.stun=6;npc.state='STUNNED';MF.toast('击中了。六秒，快离开他的视线。');}
    else{MF.toast('没有击中。剩余 '+st.ammo+' 发。');}
  }
  shootEl.onclick=shoot;
  document.getElementById('night-bag').onclick=()=>document.body.classList.toggle('inventory-open');
  window.addEventListener('keydown',e=>{if(e.repeat||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable)return;
    if(e.code==='KeyG')shoot();
    if(e.code==='KeyB')document.body.classList.toggle('inventory-open');
    if(work&&e.code==='Escape'){closeWork();e.preventDefault();}
  });

  const wallSegments=[];
  for(const c of colliders){if(c.type!=='bounds')continue;
    for(const side of ['w','e','n','s']){const vertical=side==='w'||side==='e',start=vertical?c.minZ:c.minX,end=vertical?c.maxZ:c.maxX;
      const fixed=side==='w'?c.minX:side==='e'?c.maxX:side==='n'?c.minZ:c.maxZ;
      const gaps=(c.gaps||[]).filter(g=>g.s===side).sort((a,b)=>a.a-b.a);let from=start;
      const push=(a,b)=>{if(b<=a)return;wallSegments.push(vertical?{x0:fixed,z0:a,x1:fixed,z1:b,h:c.H||5}:{x0:a,z0:fixed,x1:b,z1:fixed,h:c.H||5});};
      for(const gap of gaps){push(from,gap.a);from=Math.max(from,gap.b);}push(from,end);
    }
  }
  const roundRooms=colliders.filter(c=>c.type==='round');
  roundRooms.forEach(c=>{for(let i=0;i<60;i++){const a=(i+0.5)*Math.PI/30;if(a<0.108||Math.abs(a-Math.PI*2)<0.108||Math.abs(a-Math.PI*1.5)<0.108)continue;
    wallSegments.push({x0:c.x+Math.sin(a-Math.PI/60)*c.r,z0:c.z+Math.cos(a-Math.PI/60)*c.r,x1:c.x+Math.sin(a+Math.PI/60)*c.r,z1:c.z+Math.cos(a+Math.PI/60)*c.r,h:c.H});}});
  const rooms=colliders.filter(c=>c.type==='bounds');
  const solid=colliders.filter(c=>c.type==='box'||c.type==='cyl'||c.type==='seg');
  const pointSegment=(x,z,a)=>{const dx=a.x1-a.x0,dz=a.z1-a.z0,L=dx*dx+dz*dz;const u=L?Math.max(0,Math.min(1,((x-a.x0)*dx+(z-a.z0)*dz)/L)):0;return Math.hypot(x-a.x0-u*dx,z-a.z0-u*dz);};
  function inShape(x,z,c,r){
    if(c.type==='box')return Math.abs(x-c.x)<c.w/2+r&&Math.abs(z-c.z)<c.d/2+r;
    if(c.type==='cyl')return Math.hypot(x-c.x,z-c.z)<c.r+r;
    return pointSegment(x,z,c)<(c.r||0.1)+r;
  }
  function blocked(x,z,r=0.31,planning=false){
    if(!rooms.some(c=>x>=c.minX-0.001&&x<=c.maxX+0.001&&z>=c.minZ-0.001&&z<=c.maxZ+0.001)&&!roundRooms.some(c=>Math.hypot(x-c.x,z-c.z)<=c.r-r))return true;
    if(inSafe({x,z}))return true;
    if(wallSegments.some(w=>pointSegment(x,z,w)<r+0.06))return true;
    if(solid.some(c=>!c.off&&!(planning&&c.autoDoor)&&(c.yMin===undefined||c.yMin<0.35)&&inShape(x,z,c,r)))return true;
    return surfaces.some(c=>c.solid&&c.y>0.46&&x>c.x0-r&&x<c.x1+r&&z>c.z0-r&&z<c.z1+r);
  }
  function lineClear(a,b,interact=false){
    const d=distance(a,b),n=Math.max(1,Math.ceil(d/0.16));
    for(let i=1;i<n;i++){
      const u=i/n,x=a.x+(b.x-a.x)*u,z=a.z+(b.z-a.z)*u,y=(a.y||1.35)+((b.y||1.35)-(a.y||1.35))*u;
      if(wallSegments.some(w=>w.h>y&&pointSegment(x,z,w)<0.1))return false;
      for(const c of solid){if(c.off||c.type==='seg'||c.sight===false||(c.h||2)<y||(c.yMin||0)>y)continue;
        if(interact&&inShape(b.x,b.z,c,0.12)&&!c.wall)continue;
        if(inShape(x,z,c,0))return false;}
    }
    return true;
  }
  const grid={minX:-24,minZ:-140,step:0.6,w:85,h:256};
  const cell=(x,z)=>({x:Math.round((x-grid.minX)/grid.step),z:Math.round((z-grid.minZ)/grid.step)});
  const world=(x,z)=>({x:grid.minX+x*grid.step,z:grid.minZ+z*grid.step});
  function findPath(a,b){
    const total=grid.w*grid.h,cache=new Int8Array(total);
    const ok=(x,z)=>{if(x<0||x>=grid.w||z<0||z>=grid.h)return false;const id=z*grid.w+x;if(!cache[id]){const p=world(x,z);cache[id]=blocked(p.x,p.z,0.31,true)?-1:1;}return cache[id]>0;};
    function nearest(p){const c=cell(p.x,p.z);for(let r=0;r<=4;r++)for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){if(r&&Math.abs(dx)!==r&&Math.abs(dz)!==r)continue;if(ok(c.x+dx,c.z+dz))return {x:c.x+dx,z:c.z+dz};}return null;}
    const from=nearest(a),to=nearest(b);if(!from||!to)return [];
    const begin=from.z*grid.w+from.x,end=to.z*grid.w+to.x,queue=new Int32Array(total),parent=new Int32Array(total);parent.fill(-1);
    let head=0,tail=1;queue[0]=begin;parent[begin]=begin;
    while(head<tail&&parent[end]===-1){const id=queue[head++],x=id%grid.w,z=Math.floor(id/grid.w);
      for(const d of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+d[0],nz=z+d[1],ni=nz*grid.w+nx;if(!ok(nx,nz)||parent[ni]!==-1)continue;parent[ni]=id;queue[tail++]=ni;}
    }
    if(parent[end]===-1)return [];
    const path=[];let id=end;while(id!==begin){path.push(world(id%grid.w,Math.floor(id/grid.w)));id=parent[id];}path.reverse();return path;
  }
  const routes=[[[-15.3,-4.17],[-14.1,-6],[-9,-6],[-3.2,-21],[-3.2,-38],[3.2,-38],[4,-22],[4,-10],[-3.3,-44],[-8,-26]],
    [[4.5,-56],[0,-61],[-9.5,-62.5],[0,-69],[-2,-77],[0,-85],[10,-89],[0,-98],[-10,-82.5]]];
  function sendCoworkerToSeat(){st.intro=true;if(coworkerMode!=='WAIT')return;coworkerPath=findPath(coworker.position,{x:6.99,z:10.54});coworkerAt=0;coworkerMode='WALK';}
  const frogReady=FrogActor.ready.then(()=>{coworkerModel=FrogActor.create(1.5);coworker.add(coworkerModel.root);});
  function updateCoworker(dt){
    if(coworkerMode==='WAIT')coworker.rotation.y=Math.atan2(coworker.position.x-camera.position.x,coworker.position.z-camera.position.z);
    if(coworkerMode==='WALK'){
      const p=coworkerPath[coworkerAt]||{x:6.99,z:10.54},dx=p.x-coworker.position.x,dz=p.z-coworker.position.z,d=Math.hypot(dx,dz);
      if(d<0.07){if(coworkerAt<coworkerPath.length)coworkerAt++;else{coworkerMode='PLAY';coworker.position.set(6.99,0.35,10.54);coworker.rotation.y=Math.PI;}}
      else{const step=Math.min(dt*1.1,d),x=coworker.position.x+dx/d*step,z=coworker.position.z+dz/d*step;
        if(!blocked(x,z,0.22)){coworker.position.set(x,0,z);coworker.rotation.y=Math.atan2(-dx,-dz);}}
    }
    coworkerProp.pos.x=coworker.position.x;coworkerProp.pos.z=coworker.position.z;
    if(coworkerModel)coworkerModel.update(dt,coworkerMode==='WALK'?'walk':coworkerMode==='PLAY'?'play':'idle',1);
  }
  const actor=add('孙笑川',new THREE.Group());actor.position.copy(npc.pos);
  let npcMesh=null,frame=-1,sheets=[];
  const atlas=window.PAPERBOT_ATLAS;
  const ready=Promise.all(atlas.sheets.map(src=>new Promise(resolve=>new THREE.TextureLoader().load(src,t=>{
    t.magFilter=THREE.NearestFilter;t.minFilter=THREE.LinearFilter;t.generateMipmaps=false;resolve(t);
  },undefined,()=>resolve(null))))).then(loaded=>{
    sheets=loaded;if(sheets.some(t=>!t)){MF.toast('孙笑川贴图加载失败，请刷新页面。');return;}
    const mat=new THREE.MeshBasicMaterial({map:sheets[0],alphaTest:0.42,side:THREE.DoubleSide,color:0xc3c9bd});
    npcMesh=new THREE.Mesh(new THREE.PlaneGeometry(2.3*atlas.fw/atlas.fh,2.3),mat);npcMesh.position.y=1.15;actor.add(npcMesh);setFrame(0);
  });
  function setFrame(i){if(!npcMesh||i===frame)return;frame=i;
    const per=atlas.cols*atlas.rows,si=Math.floor(i/per),fi=i%per,t=sheets[si],img=t.image;
    t.offset.set(((fi%atlas.cols)*atlas.cellW+atlas.pad)/img.width,1-(Math.floor(fi/atlas.cols)*atlas.cellH+atlas.pad+atlas.fh)/img.height);
    t.repeat.set(atlas.fw/img.width,atlas.fh/img.height);npcMesh.material.map=t;
  }
  function setAnger(v){st.anger=Math.min(100,Math.max(st.valve?80:0,v));refreshHint();}
  function transfer(){if(npc.zone===1)return;npc.zone=1;npc.route=0;npc.state='TRANSFER';npc.path=[];npc.repath=0;refreshHint();}
  function pullValve(){if(st.valve)return;st.valve=true;st.visited2=true;setAnger(85);transfer();npc.last.set(0,0,-70);if(npc.state!=='TRANSFER'){npc.state='INVESTIGATE';npc.path=[];npc.repath=0;}audio.play('sfx_stinger',0.45);audio.play('sfx_sc_roar',0.6);
    MF.toast('阀门触发了警报。无论有没有进办公室，他都会追来。西侧绿灯是安全屋。',6500);refreshHint();}
  function caught(){if(st.capturing)return;st.caught++;G.caught++;st.capturing=true;npc.state='CAPTURE';npc.seen=false;npc.path=[];npc.repath=0;
    closeWork();if(arcade)arcade.close();if(st.hidden)exitHide();MF.state.dead=false;ctx.clearKeys();
    capturePose={x:camera.position.x,y:Math.max(1.35,camera.position.y),z:camera.position.z,yaw:Math.atan2(camera.position.x-npc.pos.x,camera.position.z-npc.pos.z)};
    ctx.setPose(capturePose.x,capturePose.y,capturePose.z,capturePose.yaw);
    audio.play('sfx_sc_attitude',0.6);
    MF.dialog('孙笑川',['なんで私の言うことを聞いてくれないの？','なんでそんなに頑固なの？'],()=>{
      st.capturing=false;capturePose=null;ctx.clearKeys();npc.cooldown=10;npc.state='PATROL';npc.search=0;npc.lost=0;npc.path=[];npc.repath=0;
      MF.toast(st.arcadeChase?'他松开了你，赶紧回工位。':'他松开了你。利用转角离开，剧情与收集进度已保留。',4000);refreshHint();
    });refreshHint();}
  function walkNPC(dt){if(npc.pathAt>=npc.path.length)return false;
    const target=npc.path[npc.pathAt],dx=target.x-npc.pos.x,dz=target.z-npc.pos.z,d=Math.hypot(dx,dz);
    if(d<0.1){npc.pathAt++;return true;}
    const speed=npc.state==='CHASE'?2.5+st.anger*0.01:npc.state==='TRANSFER'?2.4:1.25+st.anger*0.006;
    const step=Math.min(speed*dt,d),x=npc.pos.x+dx/d*step,z=npc.pos.z+dz/d*step;
    if(blocked(x,z)){npc.path=[];npc.repath=0.2;return false;}
    npc.pos.set(x,0,z);npc.yaw=Math.atan2(dx,dz);npc.travel+=step;return true;
  }
  function updateNPC(dt){
    npc.cooldown=Math.max(0,npc.cooldown-dt);npc.repath-=dt;
    if(npc.stun>0){npc.stun-=dt;npc.state='STUNNED';if(npc.stun<=0){npc.state='SEARCH';npc.search=5;npc.repath=0;}return;}
    const d=distance(npc.pos,camera.position),dx=camera.position.x-npc.pos.x,dz=camera.position.z-npc.pos.z;
    const facing=(Math.sin(npc.yaw)*dx+Math.cos(npc.yaw)*dz)/Math.max(0.01,d);
    const see=!st.hidden&&!inSafe(camera.position)&&Math.abs(camera.position.y-1.35)<1.6&&d<17&&(facing>0.2||d<2)&&lineClear({...npc.pos,y:1.6},camera.position);
    npc.seen=see;
    if(st.arcadeChase&&!st.hidden&&!inSafe(camera.position)&&npc.cooldown<=0){npc.last.copy(camera.position);npc.lost=0;npc.state='CHASE';}
    else if(see&&st.anger>=60&&npc.cooldown<=0&&(!MF.state.dead||st.anger>=80)){npc.last.copy(camera.position);npc.lost=0;npc.state='CHASE';}
    else if(npc.state==='CHASE'){npc.lost+=dt;if(npc.lost>1.5){npc.state='INVESTIGATE';npc.repath=0;}}
    if(npc.state==='CHASE'&&d<0.95&&see&&npc.cooldown<=0){caught();return;}
    if(st.hidden&&st.exposed&&d<2.6){npc.search+=dt;if(npc.search>3){caught();return;}}
    let target;
    if(npc.state==='TRANSFER'){target={x:4.5,z:-56};if(distance(npc.pos,target)<1.2){npc.state=st.valve?'INVESTIGATE':'PATROL';npc.repath=0;}}
    if(npc.state==='CHASE')target=camera.position;
    else if(npc.state==='INVESTIGATE'){target=npc.last;if(distance(npc.pos,target)<1.2){npc.state='SEARCH';npc.search=6;npc.path=[];}}
    else if(npc.state==='SEARCH'){npc.search-=dt;npc.yaw+=dt*0.8;if(npc.search<=0){npc.state='PATROL';npc.repath=0;}return;}
    else if(npc.state==='PATROL'){
      const r=routes[npc.zone],p=r[npc.route%r.length];target={x:p[0],z:p[1]};
      if(distance(npc.pos,target)<1.2){npc.wait-=dt;if(npc.wait>0)return;npc.route=(npc.route+1)%r.length;npc.wait=1.2;npc.repath=0;target={x:r[npc.route][0],z:r[npc.route][1]};}
    }
    if(target&&npc.repath<=0){npc.path=findPath(npc.pos,target);npc.pathAt=0;npc.repath=npc.state==='CHASE'?0.8:3;
      if(!npc.path.length&&npc.state==='PATROL'){npc.route++;npc.repath=0.5;}}
    walkNPC(dt);
  }

  const door=MF.getProp('door'),oldDoorAction=door.action;
  door.label=()=>!st.shiftDone?'员工出口（先完成三瓶合格品）':'员工出口 · 前往停车场';
  door.action=()=>{if(!st.shiftDone){MF.toast('NO.07：先做完三瓶合格品，我会把钥匙给你。');return;}oldDoorAction();};
  const lock=box('厂2夜班门',-3.3,-46,3.2,0.18,2.65,0x536259,true);solid.push(lock.col);
  sign(['02 发酵厂','下班后解除门禁'], -3.3,2,-45.87,0,2);
  prop('factory2door',-3.3,-45.45,()=>st.shiftDone?'打开厂2门 / 调查异响':'厂2门禁 · 先完成夜班',()=>{
    if(!st.shiftDone){MF.toast('先回操作椅完成三瓶合格品。');return;}lock.mesh.visible=false;lock.col.off=true;MF.toast('厂2的声音更近了。可以随时原路返回停车场。');},2.1);
  const oldRed=MF.getProp('redbtn');
  oldRed.action=()=>{if(MF.state.flags.tapesInserted<3||!G.valveDone){MF.toast('需要三盘磁带，以及草莓3、巧克力2、薄荷1的阀门配方。');return;}
    if(st.pumpOff){MF.toast('泵已停止。母液罐侧面的红色接口松开了。');return;}
    MF.confirm('停止主泵？\n停泵不会杀死罐里的奶泡。',ok=>{if(!ok)return;st.pumpOff=true;audio.play('sfx_factory_death',0.5);MF.dialog('奶泡',['谢谢。但停泵只是让我不再产奶。','红色接口松开了。你愿意拔掉管子，让我也离开吗？']);refreshHint();});};
  prop('foam',0,-118,'听母液罐里的声音',()=>{st.foam=Math.min(3,st.foam+1);MF.dialog('奶泡',[st.foam===1?'又一只。第几号了？……算了，都一样。':st.foam===2?'老哞不是坏人。他只是太想她了。那孩子的声音是录下来的。':'真正的她，声音比录音更哑。你愿意听我把话说完，已经很好了。']);},2.1);
  const redPipe=box('母液罐红色解脱阀',-3.6,-122,0.38,0.5,1.4,0x9b453d);
  sign(['红色接口','停泵后可拔管'], -3.6,1.9,-121.7,0,1.5);
  prop('unplug',-3.6,-121.1,()=>st.unplugged?null:st.pumpOff?'拔掉红色管子':'红色管子（先停泵）',()=>{
    if(!st.pumpOff){MF.toast('泵还在运转。');return;}
    MF.confirm('拔掉后警报将持续 30 秒。\n准备好前往后门了吗？',ok=>{if(!ok)return;st.unplugged=true;st.escapeTime=30;redPipe.mesh.visible=false;redPipe.col.off=true;
      audio.play('sfx_stinger',0.6);MF.dialog('奶泡',['谢谢。告诉老哞……我不怪他。','（后门正在解除锁定。红灯开始倒计时。）']);refreshHint();});},1.8);
  sign(['员工后门','E 离厂 / 停车场'], 0,2,-137.2,0,2.6);
  prop('pump-exit',0,-135.6,'后门 · 离开工厂',()=>leave(),2.2);
  const tapeText=[['老哞',['小哞又偷喝奶了。拉肚子还笑……她说这是家的味道。']],['老哞',['奶泡很乖。它什么都懂。','对不起，奶泡。']],['小哞 · AI 录音',['爸爸，我不想喝奶了，我想你抱我。','老哞：（很长的沉默）……再产一批就好了。']]];
  const heard=new Set();let replay=0;
  function playTape(){const owned=MF.state.inv.tapes.map((v,i)=>v?i:-1).filter(i=>i>=0);if(!owned.length){MF.toast('先找回磁带：厂1休息室收音机、厂2冷库。');return;}
    const next=owned.find(i=>!heard.has(i))??owned[replay++%owned.length];audio.play('sfx_tape_hiss',0.2);
    MF.dialog(tapeText[next][0],tapeText[next][1],()=>{heard.add(next);MF.state.flags.truthHeard=heard.size;MF.refreshPanel();refreshHint();});}
  for(const id of ['tapeplayer','altarplayer'])MF.getProp(id).action=playTape;
  prop('safe-tapes',-16.75,-57.2,()=>st.gun?'重听员工磁带':null,playTape,1.75);
  function leave(){
    if(st.leaving||uiBusy())return;
    if(!st.shiftDone){MF.toast('先完成夜班，再决定是否留下调查。');return;}
    if(st.unplugged&&st.escapeTime>0){MF.toast('后门解锁还需 '+Math.ceil(st.escapeTime)+' 秒。');return;}
    const truth=MF.state.flags.truthHeard;
    MF.confirm(st.unplugged?'后门开了。带奶泡的最后一句话离开？':truth?'你已听见罐子里的声音。\n确定现在就走，留下仍在生产的工厂？':'按时下班，去停车场开车？\n也可以留下调查办公室和厂2。',ok=>{
      if(!ok){ctx.setPose(S.scene===2?0:19.84,1.35,S.scene===2?-134:-17.0,0);return;}
      st.leaving=true;G.endingEscape=true;const branch=st.unplugged?'wean':st.visited2?'investigate':'early';
      try{sessionStorage.setItem('mf_handoff',JSON.stringify({branch,anger:st.anger,truthHeard:truth,tapes:MF.tapeCount(),elapsed:Math.round(MF.elapsed()),act:S.scene+1}));}catch(e){}
      NightMusic.handoff();audio.playing.forEach(a=>a.pause());location.href='yard.html?from=factory&route='+branch;
    });
  }
  function refreshHint(){
    let hint=!st.started?'夜班 / 第 13 号试饮员':!st.shiftDone?'NO.07：沿传送带右侧黄线，到操作椅封好三瓶。':!st.visited2?'钥匙在背包里。右侧绿门能下班；西侧厕所能听清异响。':!st.valve?'厂2：阀门后的声音在叫你。西侧绿灯是安全屋。':!st.pumpOff?'他已经追来了。利用罐体和转角断开视线，冷库里有磁带。':st.unplugged?'后门解锁 '+Math.ceil(st.escapeTime)+' 秒 · 向主泵室尽头走。':'奶泡还在罐子里。你可以拔管，也可以直接离开。';
    if(st.arcadeChase)hint='孙笑川正在追你：回到黄色操作椅，结束这次摸鱼追捕。';
    if(st.capturing)hint='被孙笑川抓住 · E / 点击继续对话，结束后恢复行动。';
    document.getElementById('hudGoal').textContent=hint;
    document.getElementById('hudCount').textContent=G.got;document.getElementById('hudTape').textContent=G.tapes;
    statusEl.hidden=!st.started;statusEl.classList.toggle('danger',npc.state==='CHASE');
    statusEl.querySelector('strong').textContent=st.hidden?'屏住呼吸':npc.state==='CHASE'?'他看见你了':npc.state==='STUNNED'?'暂时安全':inSafe(camera.position)?'安全屋':'愤怒 '+Math.round(st.anger)+' / 100';
    const names={PATROL:'巡逻',TRANSFER:'正前往厂2',INVESTIGATE:'查看声源',SEARCH:'搜索最后目击处',CHASE:'追捕',STUNNED:'被击晕',CAPTURE:'训话'};
    statusEl.querySelector('span').textContent='孙笑川 · '+(npc.pos.z<-106?'厂3':npc.pos.z<-50?'厂2':'厂1')+' · '+names[npc.state]+(st.gun?' / 镇静弹 '+st.ammo:'');
  }
  function resetPose(){closeWork();if(arcade)arcade.close();if(st.hidden)exitHide();if(st.capturing)capturePose={x:camera.position.x,y:camera.position.y,z:camera.position.z,yaw:ctx.getYaw()};ctx.clearKeys();}
  function start(skip){st.started=true;statusEl.hidden=false;officeHum=audio.loop('amb_distant_whispers',0.01);
    if(!skip){MF.dialog('NO.07 · 同事',['喂，第 13 号，你把传送带当床了？','从右边的窄门下来，沿黄线到操作椅。点击停线，浅绿色那段才算合格。','三瓶合格品就下班。我去调试室玩游戏了，你可别被孙笑川抓到。'],sendCoworkerToSeat);}
    else{sendCoworkerToSeat();if(S.scene>0){st.good=3;st.shiftDone=true;MF.state.inv.floorKey=true;lock.col.off=true;lock.mesh.visible=false;st.visited2=true;setAnger(40);transfer();}}
    refreshHint();
  }
  function canInteract(p){if(st.hidden)return p.id===hiddenCabinet.id;
    if(Math.abs(camera.position.y-(p.pos.y||1.35))>1.9)return false;
    return lineClear(camera.position,{x:p.pos.x,y:p.pos.y||1.35,z:p.pos.z},true);}
  function update(t,dt){
    if(!st.started||S.pause||dt<=0)return;
    elapsed+=dt;
    for(let i=events.length-1;i>=0;i--)if(events[i].at<=elapsed&&!uiBusy()){const event=events.splice(i,1)[0];event.fn();}
    NightMusic.setDucked(uiBusy()||npc.state==='CHASE');
    if(work){workT+=dt;cursor=(workT*0.6)%1;cursorEl.style.left=cursor*100+'%';}
    const arcadeWasOpen=arcade.isOpen();arcade.update(dt);if(arcadeWasOpen)arcadeTexture.needsUpdate=true;
    fans.forEach((fan,i)=>fan.rotation.y+=dt*(1.8+i*0.17));
    if(st.hidden)pinCabinet();
    if(st.capturing&&capturePose)ctx.setPose(capturePose.x,capturePose.y,capturePose.z,capturePose.yaw);
    if(!uiBusy())updateCoworker(dt);
    if(!uiBusy()&&!work&&!arcade.isOpen()&&!st.capturing){
      if(st.arcadeChase&&distance(camera.position,{x:2.8,z:-16.96})<1.65&&Math.abs(camera.position.y-1.35)<0.8)finishArcadeChase();
      if(S.scene===1&&!st.visited2){st.visited2=true;setAnger(Math.max(st.anger,40));transfer();audio.play('amb_distant_whispers',0.4);MF.toast('厂2的管道里也有人说话。先记住左侧安全屋，再碰阀门。',5500);}
      if(insideOffice(camera.position)&&!st.office){st.office=true;setAnger(65);npc.last.copy(camera.position);npc.state='INVESTIGATE';npc.repath=0;audio.play('sfx_sc_attitude',0.6);MF.dialog('孙笑川',['誰の許可で事務所に入ってきたんだ？']);}
      if(st.unplugged)st.escapeTime=Math.max(0,st.escapeTime-dt);
      if(!uiBusy())updateNPC(dt);
    }
    actor.position.copy(npc.pos);actor.rotation.y=Math.atan2(camera.position.x-npc.pos.x,camera.position.z-npc.pos.z);
    actor.rotation.z=npc.stun>0?0.8:0;setFrame(Math.floor(npc.travel*7)%atlas.count);
    breathT+=dt;if(breathT>0.35){breathT=0;refreshHint();}
    if(st.shiftDone&&!st.eavesdrop&&!st.visited2){noiseT+=dt;if(noiseT>24){noiseT=0;audio.play('amb_distant_whispers',0.15);MF.toast('西侧厕所通风管又响了一声。');}}
    if(officeHum){const d=distance(camera.position,S.scene===0?{x:-16.12,z:-4.17}:{x:0,z:-106});officeHum.a.volume=Math.max(0,1-d/22)*(work?0.18:0.12);}
    if(npc.travel-footAt>1.1){footAt=npc.travel;const d=distance(npc.pos,camera.position);if(d<18)audio.play('sfx_sticky_step',(1-d/18)*0.23);}
  }
  return {start,update,refreshHint,resetPose,leave,pullValve,setAnger,findPath,lineClear,blocked,ready:Promise.all([ready,frogReady]),
    nearNPC:(x,z)=>distance(npc.pos,{x,z}),
    blocksInput:()=>work||st.hidden||st.capturing||arcade.isOpen(),workOpen:()=>work||arcade.isOpen(),isHidden:()=>st.hidden,
    canInteract,status:()=>({story:{...st},npc:{x:npc.pos.x,z:npc.pos.z,yaw:npc.yaw,state:npc.state,zone:npc.zone,seen:npc.seen,path:npc.path.length,pathAt:npc.pathAt,stun:npc.stun},work,cursor,
      coworker:{x:coworker.position.x,z:coworker.position.z,mode:coworkerMode,path:coworkerPath.length,pathAt:coworkerAt},arcade:arcade.status(),cabinet:hiddenCabinet&&hiddenCabinet.id}),
    cabinets:()=>cabinets.map(c=>({id:c.id,x:c.x,z:c.z,front:{...c.front},exit:{...c.exit},angle:c.angle})),
    routes:()=>routes.map(r=>r.map(p=>({x:p[0],z:p[1]})))};
};
