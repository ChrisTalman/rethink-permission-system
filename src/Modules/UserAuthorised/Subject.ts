'use strict';

// External Modules
import { r as RethinkDB } from 'rethinkdb-ts';

// Types
import { RDatum } from 'rethinkdb-ts';
import { PermissionSystem, Permission, PermissionTargetEntity, UserRoles } from 'src/Modules';
import { SubjectPermissionParameter, PermissionParameterEvaluation } from './';

// Constants
import
{
	SPECIAL_ID_ALL,
	NEGATED,
	NOT_NEGATED,
	NOT_DELETED
} from 'src/Modules/Constants';

export function generateUserAuthorisedBySubjectQuery <GenericPermissionType extends string, GenericTargetEntityType extends string>
(
	{domainId, userRoles, permission, subject, parameter, system}:
	{
		domainId: string | RDatum <string>,
		userRoles: RDatum <UserRoles <GenericTargetEntityType>>,
		permission: RDatum <GenericPermissionType>,
		subject: RDatum <PermissionTargetEntity <any>>,
		parameter: RDatum <SubjectPermissionParameter <any, any>>,
		system: PermissionSystem <any, any, any, any>
	}
)
{
	const query: RDatum <PermissionParameterEvaluation> = resolveSubjectEntities({subject, system})
		.coerceTo('array')
		.do
		(
			(subjects: RDatum) => RethinkDB
				.expr
				(
					{
						granted: RethinkDB
							.table<Permission <any>>(system.table)
							.getAll
							(
								RethinkDB.args
								(
									userRoles
										.concatMap
										(
											role => subjects
												.concatMap
												(
													subject =>
													[
														[ domainId, permission, NOT_NEGATED, role('id'), role('type'), SPECIAL_ID_ALL, subject('type'), NOT_DELETED ],
														[ domainId, permission, NOT_NEGATED, role('id'), role('type'), subject('id'), subject('type'), NOT_DELETED ]
													]
												) as any
										) as any
								),
								{ index: system.indexes.subject }
							)
							.count()
							.gt(0),
						negated: RethinkDB
							.table<Permission <any>>(system.table)
							.getAll
							(
								RethinkDB.args
								(
									userRoles
										.concatMap
										(
											role => subjects
												.concatMap
												(
													subject =>
													[
														[ domainId, permission, NEGATED, role('id'), role('type'), SPECIAL_ID_ALL, subject('type'), NOT_DELETED ],
														[ domainId, permission, NEGATED, role('id'), role('type'), subject('id'), subject('type'), NOT_DELETED ]
													]
												) as any
										) as any
								),
								{ index: system.indexes.subject }
							)
							.count()
							.gt(0),
						parameter
					}
				)
		)
		.merge
		(
			(evaluations: RDatum<PermissionParameterEvaluation>) =>
			(
				{
					authorised: RethinkDB.and
					(
						evaluations('granted').eq(true),
						evaluations('negated').eq(false)
					)
				}
			)
		);
	return query;
};

/** Resolves to an array consisting of the given `subject` and any other subjects returned by `subjectEntities()`, if provided. */
function resolveSubjectEntities({subject, system}: {subject: RDatum <PermissionTargetEntity <any>>, system: PermissionSystem <any, any, any, any>})
{
	const query = RethinkDB
		.union
		(
			[ subject ],
			system
				.queries
				.subjectEntities
				?
					system.queries.subjectEntities({entity: subject})
				:
					[] as any
		) as any as RDatum <Array <PermissionTargetEntity <any>>>;
	return query;
};