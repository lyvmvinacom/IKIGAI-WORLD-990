export function scoreExam(exam, answers) {
 const breakdown=exam.sections.map((s,i)=>({id:s.id,title:s.title,total:s.questions.length,correct:s.questions.reduce((n,q,j)=>n+(Number.isInteger(answers?.[i]?.[j])&&answers[i][j]===q.answer?1:0),0)}));
 const written=Math.round((breakdown[0].correct+breakdown[1].correct)*120/(breakdown[0].total+breakdown[1].total));
 const listening=Math.round(breakdown[2].correct*60/breakdown[2].total);
 const references=['vocabulary','grammar','reading'].map(group=>{let correct=0,total=0;exam.sections.forEach((s,i)=>s.questions.forEach((q,j)=>{if(q.group===group){total++;if(answers?.[i]?.[j]===q.answer)correct++}}));const ratio=total?correct/total:0;return{group,correct,total,grade:ratio>=.67?'A':ratio>=.34?'B':'C'}});
 return {written,listening,total:written+listening,passed:written+listening>=90&&written>=38&&listening>=19,breakdown,references,method:'IKIGAI_LINEAR_V1'};
}
