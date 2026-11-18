// Conservative transcript rules, not acoustic pronunciation assessment.
export function assess(question, raw){
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
