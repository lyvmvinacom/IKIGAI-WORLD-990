// Conservative transcript rules, not acoustic pronunciation assessment.
function legacyAssess(question, raw){
 const a=raw.normalize('NFKC').replace(/[\s、。！？!?]/g,'');
 const q=question.replace(/\s/g,'');
 const result=(kind,text='',category='')=>({kind,text,category});
 if(!a)return result('unclear');
 if(/もう一度|もういちど|聞こえません|きこえません|ゆっくり/.test(a))return result('repeat');
 if(/^(すみません)?(わかりません|分かりません|答えられません|こたえられません)(すみません)?$/.test(a))return result('help');
 if(!/[ぁ-んァ-ヶ一-龯]/.test(a)||/^(ええと|えっと|あの|うーん|はいはい|はじめまして)$/.test(a))return result('unclear');
 if(/なんじに/.test(q)){
  const m=a.match(/^((?:[0-9一二三四五六七八九十]+|[いちにさんしごろくなはきゅうじゅ]+)(?:時|じ)(?:半|はん|[0-9一二三四五六七八九十]+(?:分|ふん|ぷん))?)(?:(を|で|へ|が))?((?:起き|おき|寝|ね|行き|いき|帰り|かえり)ま(?:す|した))$/);
  if(m)return result('correct',m[1]+'に'+m[3],'Trợ từ に');
 }
 if(/なにで.*いきます/.test(q)){
  const m=a.match(/^(バス|バイク|自転車|じてんしゃ|車|くるま|電車|でんしゃ|タクシー|飛行機|ひこうき)(?:を|に|が|へ)?(行きます|いきます)$/);
  if(m)return result('correct',m[1]+'で'+m[2],'Trợ từ で');
  if(/^(歩いて|あるいて)です$/.test(a))return result('correct',a.replace(/です$/,'いきます'),'Mẫu câu');
 }
 if(/だれと.*いきます/.test(q)){
  const m=a.match(/^(友達|友だち|ともだち|家族|かぞく|先生|せんせい|一人|ひとり)(?:に|を|で)?(行きます|いきます)$/);
  if(m&&!/一人|ひとり/.test(m[1]))return result('correct',m[1]+'と'+m[2],'Trợ từ と');
 }
 if(/きのう/.test(q)&&/ますか|ましたか/.test(q)&&/ます$/.test(a)){
  const m=a.match(/^(.*)(起き|おき|寝|ね|行き|いき|帰り|かえり|勉強し|べんきょうし)ます$/);
  if(m)return result('confirm',m[1]+m[2]+'ましたか','Thời quá khứ');
 }
 if(/まいあさ|まいばん|あした/.test(q)&&/ました$/.test(a))return result('confirm',a.replace(/ました$/,'ますか'),'Thời hiện tại/tương lai');
 if(/なんじ/.test(q)&&!/(時|じ|分|ふん|ぷん|半|はん)/.test(a)&&!/^いいえ/.test(a))return result('unclear');
 if(/^(はい|いいえ)(です)?$/.test(a)&&/なん|なに|だれ|どこ|どんな|いつ|いくら|どう/.test(q))return result('unclear');
 return result('accept');
}
export function branch(question,answer){
 const q=question.replace(/\s/g,'');
 if(/きのうべんきょうしましたか/.test(q)&&/いいえ|ませんでした/.test(answer))return 'なんじから べんきょうしましたか';
 if(/あさごはんをたべますか/.test(q)&&/いいえ|たべません|食べません/.test(answer))return 'なにを たべますか';
 return '';
}

export function normalize(t){return t.normalize('NFKC').replace(/[\s、。！？!?]/g,'')}
export function assess(question,raw){
 const a=normalize(raw),q=normalize(question);
 const out=(kind,text='',category='')=>({kind,text,category});
 if(/không hiểu|khong hieu|không biết|khong biet|khó quá/i.test(raw))return out('help');
 if(/nghe lại|nói chậm|nhắc lại/i.test(raw))return out('repeat');
 if(/^(すみません)?(わかりません|分かりません|答えられません|こたえられません)/.test(a))return out('help');
 if(/なんじに/.test(q)&&/きのう/.test(q)&&/ます$/.test(a)){const m=a.match(/^(.*(?:起き|おき|寝|ね|行き|いき|帰り|かえり))ます$/);if(m)return out('confirm',m[1]+'ましたか','Thời quá khứ')}
 const rules=[
 [/((?:学校|がっこう|センター|教室|きょうしつ|家|うち|図書館|としょかん))に((?:勉強し|べんきょうし|食べ|たべ|飲み|のみ|読み|よみ|働き|はたらき)ま(?:す|した))$/,'$1で$2','Trợ từ で'],
 [/((?:日本語|にほんご|英語|えいご|音楽|おんがく|料理|りょうり))を((?:好き|すき|上手|じょうず|下手|へた)です|(?:分かり|わかり)ます)$/,'$1が$2','Trợ từ が'],
 [/((?:ご飯|ごはん|パン|水|みず|お茶|おちゃ|本|ほん|新聞|しんぶん))が((?:食べ|たべ|飲み|のみ|読み|よみ)ま(?:す|した))$/,'$1を$2','Trợ từ を'],
 [/((?:おいし|たのし|楽|むずかし|難し|やさし|あたらし|新し|おもしろ|面白|たか|高|やす|安|いそがし|忙し))いでした$/,'$1かったです','Tính từ い'],
 [/((?:きれい|しずか|静か|げんき|元気|べんり|便利|ゆうめい|有名))なです$/,'$1です','Tính từ な'],
 [/((?:机|つくえ|いす|本|ほん|テレビ|時計|とけい))がいます$/,'$1があります','Tồn tại'],
 [/((?:先生|せんせい|学生|がくせい|友達|ともだち|犬|いぬ|猫|ねこ))があります$/,'$1がいます','Tồn tại']
 ];
 for(const [p,b,c] of rules)if(p.test(a))return out('correct',a.replace(p,b),c);
 const v=legacyAssess(question,raw);
 if(v.kind!=='accept')return v;
 if(/なんさい/.test(q)&&!/(歳|才|さい|二十歳|はたち|^[0-9]+$)/.test(a))return out('unclear');
 if(/なんようび/.test(q)&&!/(月|火|水|木|金|土|日|げつ|かよう|すい|もく|きん|どよう|にち)/.test(a))return out('unclear');
 if(/いくら/.test(q)&&!/(円|えん|ドン|ドル|[0-9]|千|万|せん|まん)/.test(a))return out('unclear');
 if(/なにで.*いきます/.test(q)&&!/(歩|あるいて|バス|バイク|車|くるま|電車|でんしゃ|自転車|じてんしゃ|タクシー|飛行機|ひこうき|船|ふね|地下鉄|ちかてつ|新幹線|しんかんせん)/.test(a))return out('unclear');
 return v;
}
export function hints(row){
 const q=normalize(row[1]);
 const words=/おきます/.test(q)?'じ、はん':/いきます/.test(q)&&/なにで/.test(q)?'バス、じてんしゃ、あるいて':/たべます/.test(q)?'パン、ごはん':/のみます/.test(q)?'みず、おちゃ':/なにをします/.test(q)?'べんきょう、しごと':/すき/.test(q)?'おんがく、スポーツ':/なんじ/.test(q)?'じ、はん':/なんようび/.test(q)?'げつようび、かようび':'';
 return [words||row[3],row[3],row[2]+' · '+row[3]];
}
export function adapt(list,index,answer,level){
 const q=normalize(list[index][1]),a=normalize(answer);
 const replace=(target,row)=>{const j=list.findIndex((r,k)=>k>index&&normalize(r[1])===normalize(target));if(j>=0)list[j]=row};
 if(/あさごはんをたべますか/.test(q)&&/いいえ|食べません|たべません/.test(a))replace('なにを たべますか',[6,'ひるごはんは なにを たべますか','Em ăn gì vào bữa trưa?','…を たべます']);
 if(/いつにほんへいきますか/.test(q)&&/わかりません|未定|まだ|行きません|いきません/.test(a)){replace('だれと にほんへ いきますか',[5,'あした だれと センターへ いきますか','Ngày mai em đi trung tâm với ai?','…と いきます']);replace('なにで にほんへ いきますか',[5,'にちようび なにで いきますか','Chủ nhật em đi bằng gì?','…で いきます'])}
 if(level>=10&&/きょうしつになにがありますか/.test(q)&&/テレビ/.test(a))replace('きょうしつに だれが いますか',[10,'テレビは どこに ありますか','Tivi ở đâu?','…に あります']);
 return list;
}
